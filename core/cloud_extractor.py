import os
import json
import time
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google.cloud import storage

from extractor import extract_from_chunk

import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google import genai
import re

INPUT_BUCKET_NAME = os.environ.get("INPUT_BUCKET", "ocr-voter-lists-input")
from google.genai.errors import APIError, ClientError

OUTPUT_BUCKET_NAME = os.environ.get("OUTPUT_BUCKET", "ocr-voter-lists-output")
DATASET_NAME = os.environ.get("DATASET_NAME", "nagar_parishad")

def process_pdf_in_memory(pdf_path, source_filename, client):
    """
    Extracts all pages, runs integrated QA, and returns a verified JSON array of voters.
    """
    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    
    # Try to extract Ward number from filename (e.g. 'ward_12.pdf' or 'Ward No-001.pdf' -> 1, 12)
    ward = None
    ward_match = re.search(r'ward\s*(?:no[-.\s]*)?(\d+)', source_filename, re.IGNORECASE)
    if ward_match:
        ward = int(ward_match.group(1))

    all_verified_voters = []
    
    for page_num in range(1, total_pdf_pages + 1):
        print(f"Processing page {page_num}/{total_pdf_pages}...")
        page = reader.pages[page_num - 1]
        
        writer = PdfWriter()
        writer.add_page(page)
            
        temp_pdf = f"/tmp/page_{page_num}.pdf"
        with open(temp_pdf, "wb") as f:
            writer.write(f)
            
        try:
            # 1. Extraction
            voters = extract_from_chunk(client, temp_pdf, page_num, page_num)
            
            # Formatting
            formatted_voters = []
            for v in voters:
                if v.get('is_deleted_or_shifted', False):
                    continue
                for key, value in v.items():
                    if isinstance(value, str):
                        v[key] = value.strip()
                if not v.get('voter_id') or str(v.get('voter_id')) == "":
                    sn = v.get('serial_number', 0)
                    v['voter_id'] = f"TEMP_ID_W{ward}_{sn}"
                if ward is not None:
                    v['ward'] = ward
                v['source_file'] = source_filename
                formatted_voters.append(v)
                
            # Finally add to global list
            all_verified_voters.extend(formatted_voters)

        except Exception as e:
            print(f"Error on page {page_num}: {e}")
        finally:
            if os.path.exists(temp_pdf):
                os.remove(temp_pdf)
                
        # Removing artificial sleep since quota is confirmed high
        pass
            
    return all_verified_voters

def main():
    print("Starting Cloud Run Job Task...")
    # Cloud Run populates CLOUD_RUN_TASK_INDEX
    task_index = int(os.environ.get("CLOUD_RUN_TASK_INDEX", 0))
    print(f"Task Index: {task_index}")

    try:
        credentials, project_id = google.auth.default()
        client = genai.Client(vertexai=True, project=project_id, location='us-central1')
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Credentials not found.")
        return

    storage_client = storage.Client()
    input_bucket = storage_client.bucket(INPUT_BUCKET_NAME)
    output_bucket = storage_client.bucket(OUTPUT_BUCKET_NAME)

    # List files in the queue folder
    prefix = f"queue/{DATASET_NAME}/"
    blobs = list(input_bucket.list_blobs(prefix=prefix))
    pdf_blobs = [b for b in blobs if b.name.endswith('.pdf')]
    pdf_blobs.sort(key=lambda x: x.name)

    if task_index >= len(pdf_blobs):
        print(f"Task {task_index} is out of bounds. Only {len(pdf_blobs)} PDFs found in {prefix}. Exiting gracefully.")
        return

    target_blob = pdf_blobs[task_index]
    filename = os.path.basename(target_blob.name)
    local_pdf_path = f"/tmp/{filename}"
    
    print(f"Task {task_index} assigned to: {filename}")
    
    # Download PDF
    target_blob.download_to_filename(local_pdf_path)
    print(f"Downloaded {filename} successfully.")

    # Process
    verified_voters = process_pdf_in_memory(local_pdf_path, filename, client)
    
    # Save output JSON
    output_filename = filename.replace('.pdf', '_voters.json')
    local_json_path = f"/tmp/{output_filename}"
    
    with open(local_json_path, 'w', encoding='utf-8') as f:
        json.dump(verified_voters, f, ensure_ascii=False, indent=2)
        
    # Upload to Output Bucket
    output_blob_path = f"{DATASET_NAME}/{output_filename}"
    output_blob = output_bucket.blob(output_blob_path)
    output_blob.upload_from_filename(local_json_path)
    
    print(f"Successfully uploaded {len(verified_voters)} voters to gs://{OUTPUT_BUCKET_NAME}/{output_blob_path}")

    # Move processed PDF to archive folder
    archive_blob_path = target_blob.name.replace("queue/", "archive/", 1)
    input_bucket.copy_blob(target_blob, input_bucket, archive_blob_path)
    target_blob.delete()
    print(f"Moved {filename} to gs://{INPUT_BUCKET_NAME}/{archive_blob_path}")

if __name__ == "__main__":
    main()

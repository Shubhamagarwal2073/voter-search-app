import os
import json
import time
import re
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google.cloud import storage

# Import existing extraction functions
from extractor import extract_from_chunk
from recorrection import extract_sample_from_crop

import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google import genai

INPUT_BUCKET_NAME = os.environ.get("INPUT_BUCKET", "ocr-voter-lists-input")
OUTPUT_BUCKET_NAME = os.environ.get("OUTPUT_BUCKET", "ocr-voter-lists-output")
DATASET_NAME = os.environ.get("DATASET_NAME", "nagar_parishad")

def process_recorrection(pdf_path, json_path, source_filename, client, ward):
    """
    Reads the PDF and the previously generated JSON.
    Runs cropped QA on each page.
    If errors found, re-extracts the page and updates the JSON array.
    Returns the updated JSON array and a boolean indicating if changes were made.
    """
    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    
    with open(json_path, 'r', encoding='utf-8') as f:
        all_voters = json.load(f)
        
    temp_dir = Path("/tmp/recorrection_temp")
    temp_dir.mkdir(exist_ok=True)
    
    flagged_pages = []
    
    for page_num in range(1, total_pdf_pages + 1):
        print(f"Running QA on page {page_num}/{total_pdf_pages}...")
        page = reader.pages[page_num - 1]
        
        # Crop to top 35%
        upper_right = page.mediabox.upper_right
        lower_left = page.mediabox.lower_left
        new_y0 = upper_right[1] - (upper_right[1] - lower_left[1]) * 0.35
        page.mediabox.lower_left = (lower_left[0], new_y0)
        
        writer = PdfWriter()
        writer.add_page(page)
            
        temp_pdf = temp_dir / f"qa_page_{page_num}.pdf"
        with open(temp_pdf, "wb") as f:
            writer.write(f)
            
        try:
            sample_voters = extract_sample_from_crop(client, str(temp_pdf), page_num)
            
            if not sample_voters:
                print(f"Page {page_num}: No voters found in sample. Skipping.")
                continue
                
            page_failed = False
            for v in sample_voters:
                sn = v.get('sn')
                sample_name = str(v.get('n', '')).strip()
                is_gibberish = v.get('is_gibberish', False)
                
                if not sn or not sample_name:
                    continue
                    
                if is_gibberish:
                    print(f"  [GIBBERISH DETECTED] Page {page_num}, SN {sn}: '{sample_name}'")
                    page_failed = True
                    break
                    
                words = sample_name.split()
                single_char_words = [w for w in words if len(w) == 1]
                if len(single_char_words) >= 3:
                    print(f"  [PYTHON DETECTED SPACED GIBBERISH] Page {page_num}, SN {sn}: '{sample_name}'")
                    page_failed = True
                    break
                    
                matra_pattern = re.compile(r'[\u093E-\u094D\u0900-\u0903]')
                bad_word = False
                for w in words:
                    if len(w) >= 4 and not matra_pattern.search(w):
                        bad_word = True
                        break
                        
                if bad_word:
                    print(f"  [PYTHON DETECTED MISSING MATRAS] Page {page_num}, SN {sn}: '{sample_name}'")
                    page_failed = True
                    break
                    
                # Cross check with our loaded JSON instead of DB
                db_record = next((voter for voter in all_voters if voter.get('ward') == ward and voter.get('serial_number') == sn), None)
                
                if db_record:
                    db_name = str(db_record.get('name_hi', '')).strip()
                    if sample_name != db_name:
                        print(f"  [MISMATCH] Page {page_num}, SN {sn}! AI QA says '{sample_name}', JSON has '{db_name}'.")
                        page_failed = True
                        break
                        
            if page_failed:
                flagged_pages.append(page_num)
            else:
                print(f"  [PASS] Page {page_num} passed QA.")
                
        except Exception as e:
            print(f"Failed to QA process page {page_num}: {e}")
            flagged_pages.append(page_num)
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()

    changes_made = False

    # AUTO-HEAL
    if flagged_pages:
        print(f"\n[ALERT] QA Complete. Found {len(flagged_pages)} corrupted pages: {flagged_pages}")
        print("Triggering automatic rescan (Auto-Heal) for flagged pages...")
        changes_made = True
        
        for page_num in flagged_pages:
            print(f"Re-extracting page {page_num}...")
            # Re-read full uncropped page
            full_reader = PdfReader(pdf_path)
            full_page = full_reader.pages[page_num - 1]
            writer = PdfWriter()
            writer.add_page(full_page)
            temp_pdf = temp_dir / f"heal_page_{page_num}.pdf"
            with open(temp_pdf, "wb") as f:
                writer.write(f)
                
            try:
                # Extract using the rigid prompt from extractor.py
                new_voters = extract_from_chunk(client, str(temp_pdf), page_num, page_num)
                
                # Format new voters
                formatted_voters = []
                for v in new_voters:
                    if v.get('is_deleted_or_shifted', False):
                        continue
                    for key, value in v.items():
                        if isinstance(value, str):
                            v[key] = value.strip()
                    if not v.get('voter_id') or str(v.get('voter_id')) == "":
                        sn = v.get('serial_number', 0)
                        ward_str = str(ward) if ward is not None else "0"
                        v['voter_id'] = f"TEMP_ID_W{ward_str}_{sn}"
                    if ward is not None:
                        v['ward'] = ward
                    v['source_file'] = source_filename
                    formatted_voters.append(v)
                
                # Remove OLD voters from this page
                # If page_number was preserved, use it. Otherwise, delete matching SNs.
                all_voters = [v for v in all_voters if v.get('page_number') != page_num]
                
                # Add NEW voters
                all_voters.extend(formatted_voters)
                print(f"  -> Fixed page {page_num}. Extracted {len(formatted_voters)} valid voters.")
                
            except Exception as e:
                print(f"Failed to auto-heal page {page_num}: {e}")
            finally:
                if temp_pdf.exists():
                    temp_pdf.unlink()
    else:
        print("\n[SUCCESS] QA Complete. ZERO errors found! Your JSON is perfect.")

    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    return all_voters, changes_made


def main():
    print("Starting Cloud Recorrection Job Task...")
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

    prefix = f"archive/{DATASET_NAME}/"
    blobs = list(input_bucket.list_blobs(prefix=prefix))
    pdf_blobs = [b for b in blobs if b.name.endswith('.pdf')]
    pdf_blobs.sort(key=lambda x: x.name)

    if task_index >= len(pdf_blobs):
        print(f"Task {task_index} is out of bounds. Exiting gracefully.")
        return

    target_blob = pdf_blobs[task_index]
    filename = os.path.basename(target_blob.name)
    local_pdf_path = f"/tmp/{filename}"
    
    print(f"Task {task_index} assigned to QA: {filename}")
    
    # Download PDF
    target_blob.download_to_filename(local_pdf_path)
    
    # Extract ward (Holding the logic identically)
    ward = None
    ward_match = re.search(r'ward\s*(?:no[-.\s]*)?(\d+)', filename, re.IGNORECASE)
    if ward_match:
        ward = int(ward_match.group(1))

    # Download JSON
    output_filename = filename.replace('.pdf', '_voters.json')
    output_blob_path = f"{DATASET_NAME}/{output_filename}"
    local_json_path = f"/tmp/{output_filename}"
    
    output_blob = output_bucket.blob(output_blob_path)
    if not output_blob.exists():
        print(f"JSON {output_blob_path} does not exist yet! Run extraction phase 1 first. Exiting.")
        return
        
    output_blob.download_to_filename(local_json_path)
    
    # Run Recorrection
    updated_voters, changes_made = process_recorrection(local_pdf_path, local_json_path, filename, client, ward)
    
    if changes_made:
        # Overwrite the JSON file
        with open(local_json_path, 'w', encoding='utf-8') as f:
            json.dump(updated_voters, f, ensure_ascii=False, indent=2)
            
        output_blob.upload_from_filename(local_json_path)
        print(f"Successfully OVERWROTE {len(updated_voters)} corrected voters to gs://{OUTPUT_BUCKET_NAME}/{output_blob_path}")
    else:
        print("No changes needed. Skipping JSON upload.")

if __name__ == "__main__":
    main()

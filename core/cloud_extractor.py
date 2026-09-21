import os
import json
import time
import re
import argparse
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google.cloud import storage
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import existing extraction and cleaning logic from core
import sys
sys.path.append(os.path.dirname(__file__))
from extractor import extract_from_chunk, clean_voter_record
from ai_config import get_genai_client, get_recommended_workers

INPUT_BUCKET_NAME = os.environ.get("INPUT_BUCKET", "ocr-voter-lists-input")
OUTPUT_BUCKET_NAME = os.environ.get("OUTPUT_BUCKET", "ocr-voter-lists-output")
DATASET_NAME = os.environ.get("DATASET_NAME", "nagar_parishad")

def is_likely_summary_page(page_num: int, total_pages: int, voter_count: int) -> bool:
    """Detects if the final page is an aggregate summary table rather than voter cards."""
    return page_num == total_pages and voter_count == 0 and total_pages > 3

def process_pdf_in_memory(pdf_path: str, source_filename: str, client, start_page: int = 3, max_workers: int = None) -> list:
    """
    Extracts all pages concurrently with ThreadPoolExecutor.
    Automatically scales worker count based on Vertex AI vs AI Studio limits.
    """
    if max_workers is None:
        max_workers = get_recommended_workers()
    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    
    # Try to extract Ward number from filename (e.g. 'Ward No-001-Part No-001.pdf' -> 1)
    ward = None
    ward_match = re.search(r'ward\s*(?:no[-.\s]*)?(\d+)', source_filename, re.IGNORECASE)
    if ward_match:
        ward = int(ward_match.group(1))

    # Pages 1 & 2 in Indian electoral rolls are administrative cover pages (no voter cards).
    # If a PDF has <= 2 pages, start at 1; otherwise default to start_page (3).
    actual_start = min(start_page, total_pdf_pages) if total_pdf_pages > 2 else 1
    
    print(f"\n[{source_filename}] Total Pages: {total_pdf_pages} | Processing Pages {actual_start} to {total_pdf_pages} (Workers: {max_workers})...")
    
    temp_dir = Path("/tmp/cloud_pages")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    all_voters = []
    failed_pages = []
    
    def process_single_page(page_idx: int) -> list:
        page_num = page_idx + 1
        page_voters = []
        temp_pdf = None
        
        try:
            page = reader.pages[page_idx]
            
            writer = PdfWriter()
            writer.add_page(page)
            
            temp_pdf = temp_dir / f"page_{page_num}_{int(time.time()*1000) % 10000}.pdf"
            with open(temp_pdf, "wb") as f:
                writer.write(f)
                
            # Extract cards with retry logic from extractor
            raw_voters = extract_from_chunk(client, str(temp_pdf), page_num, page_num)
            
            # Clean and validate each card (prefixes, matras, stamps, numerals)
            for raw in raw_voters:
                cleaned = clean_voter_record(raw, page_num, ward, source_filename)
                page_voters.append(cleaned)
                
            active_count = sum(1 for v in page_voters if not v.get('is_deleted_or_shifted'))
            deleted_count = len(page_voters) - active_count
            print(f"  -> Page {page_num:2d}/{total_pdf_pages}: Extracted {len(page_voters):2d} cards ({active_count} active, {deleted_count} deleted/shifted)")
            return page_voters
            
        except Exception as e:
            if is_likely_summary_page(page_num, total_pdf_pages, len(page_voters)):
                print(f"  -> Page {page_num:2d}/{total_pdf_pages}: End-of-roll summary page (0 voter cards). Skipped cleanly.")
                return []
            print(f"  [ERROR] Page {page_num} failed: {e}")
            failed_pages.append(page_num)
            return []
        finally:
            if temp_pdf and temp_pdf.exists():
                try:
                    temp_pdf.unlink()
                except OSError:
                    pass

    # Process pages in parallel using ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_single_page, i): i + 1 for i in range(actual_start - 1, total_pdf_pages)}
        for future in as_completed(futures):
            try:
                res = future.result()
                if res:
                    all_voters.extend(res)
            except Exception as err:
                print(f"  [ERROR] Worker thread raised exception: {err}")
                
    # Sort all extracted voters by page_number then serial_number
    all_voters.sort(key=lambda x: (x.get('page_number') or 0, x.get('serial_number') or 0))
    
    # Cleanup temp directory
    try:
        temp_dir.rmdir()
    except OSError:
        pass

    active_total = sum(1 for v in all_voters if not v.get('is_deleted_or_shifted'))
    deleted_total = len(all_voters) - active_total
    print(f"\n[DONE] Finished '{source_filename}': Total cards = {len(all_voters)} ({active_total} active, {deleted_total} deleted/shifted).")
    if failed_pages:
        print(f"[WARNING] Pages with errors: {sorted(failed_pages)}")
        
    return all_voters

def process_blob(target_blob, input_bucket, output_bucket, client, start_page: int = 3):
    """Downloads, processes, uploads JSON, and archives a single PDF blob."""
    filename = os.path.basename(target_blob.name)
    local_pdf_path = f"/tmp/{filename}"
    
    print(f"\n==================================================")
    print(f"Processing Blob: {filename}")
    print(f"==================================================")
    
    # 1. Download PDF
    target_blob.download_to_filename(local_pdf_path)
    print(f"Downloaded {filename} successfully.")

    try:
        # 2. Process with multi-threaded extraction & cleaning
        verified_voters = process_pdf_in_memory(local_pdf_path, filename, client, start_page=start_page)
        
        # 3. Save output JSON (includes both active and deleted voters with is_deleted_or_shifted flag)
        output_filename = filename.replace('.pdf', '_voters.json')
        local_json_path = f"/tmp/{output_filename}"
        
        with open(local_json_path, 'w', encoding='utf-8') as f:
            json.dump(verified_voters, f, ensure_ascii=False, indent=2)
            
        # 4. Upload to Output Bucket
        output_blob_path = f"{DATASET_NAME}/{output_filename}"
        output_blob = output_bucket.blob(output_blob_path)
        output_blob.upload_from_filename(local_json_path)
        print(f"Uploaded {len(verified_voters)} voter records to gs://{OUTPUT_BUCKET_NAME}/{output_blob_path}")

        # 5. Move processed PDF to archive folder
        archive_blob_path = target_blob.name.replace("queue/", "archive/", 1)
        input_bucket.copy_blob(target_blob, input_bucket, archive_blob_path)
        target_blob.delete()
        print(f"Moved {filename} to gs://{INPUT_BUCKET_NAME}/{archive_blob_path}")

    finally:
        if os.path.exists(local_pdf_path):
            try:
                os.remove(local_pdf_path)
            except OSError:
                pass

def main():
    default_workers = get_recommended_workers()
    parser = argparse.ArgumentParser(description="Robust Cloud OCR Extractor for Electoral Roll PDFs.")
    parser.add_argument("--start-page", type=int, default=3, help="Page to start extraction from (default: 3, skipping cover pages).")
    parser.add_argument("--workers", type=int, default=default_workers, help=f"Number of concurrent worker threads per PDF (default: {default_workers}).")
    parser.add_argument("--file", type=str, default=None, help="Process a specific local or GCS PDF filename directly.")
    parser.add_argument("--all-queue", action="store_true", help="Process all PDFs in the queue folder sequentially.")
    args = parser.parse_args()

    print("Starting Cloud OCR Extractor Pipeline...")

    try:
        client = get_genai_client()
    except Exception as e:
        print(f"ERROR: Could not initialize AI client: {e}")
        return

    storage_client = storage.Client()
    input_bucket = storage_client.bucket(INPUT_BUCKET_NAME)
    output_bucket = storage_client.bucket(OUTPUT_BUCKET_NAME)

    prefix = f"queue/{DATASET_NAME}/"
    blobs = list(input_bucket.list_blobs(prefix=prefix))
    pdf_blobs = [b for b in blobs if b.name.endswith('.pdf')]
    pdf_blobs.sort(key=lambda x: x.name)

    if not pdf_blobs:
        print(f"No PDF files found in gs://{INPUT_BUCKET_NAME}/{prefix}. Queue is empty.")
        return

    print(f"Found {len(pdf_blobs)} PDF(s) in queue: {[os.path.basename(b.name) for b in pdf_blobs]}")

    # Case A: Specific file requested
    if args.file:
        target = next((b for b in pdf_blobs if args.file in b.name), None)
        if not target:
            print(f"File '{args.file}' not found in queue.")
            return
        process_blob(target, input_bucket, output_bucket, client, start_page=args.start_page)
        return

    # Case B: Process all files in queue
    if args.all_queue:
        for b in pdf_blobs:
            try:
                process_blob(b, input_bucket, output_bucket, client, start_page=args.start_page)
            except Exception as e:
                print(f"[ERROR] Failed to process {b.name}: {e}")
        return

    # Case C: Standard Cloud Run Task mode (indexed by CLOUD_RUN_TASK_INDEX)
    task_index = int(os.environ.get("CLOUD_RUN_TASK_INDEX", 0))
    print(f"Cloud Run Task Index: {task_index}")

    if task_index >= len(pdf_blobs):
        print(f"Task {task_index} is out of bounds ({len(pdf_blobs)} PDFs in queue). Exiting gracefully.")
        return

    process_blob(pdf_blobs[task_index], input_bucket, output_bucket, client, start_page=args.start_page)

if __name__ == "__main__":
    main()

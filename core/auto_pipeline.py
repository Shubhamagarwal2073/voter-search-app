import os
import re
import json
import argparse
from google.cloud import storage
import sys

# Ensure core imports work
sys.path.append(os.path.dirname(__file__))
from cloud_extractor import process_blob
from database import get_connection, insert_voters
from recheck import run_recheck

from google import genai
import google.auth

ARCHIVE_BUCKET_NAME = "ocr-voter-lists-archive"
INPUT_BUCKET_NAME = os.environ.get("INPUT_BUCKET", "ocr-voter-lists-input")
OUTPUT_BUCKET_NAME = os.environ.get("OUTPUT_BUCKET", "ocr-voter-lists-output")
DATASET_NAME = os.environ.get("DATASET_NAME", "nagar_parishad")

# Protected wards that must NEVER be overwritten or re-extracted
PROTECTED_WARDS = {1, 3, 5, 6, 11, 19, 31, 49}

def extract_ward_number(filename: str) -> int:
    """Extracts numeric ward number from filename (e.g. 'Ward No-002-Part No-001.pdf' -> 2)."""
    m = re.search(r'ward\s*(?:no[-.\s]*)?(\d+)', filename, re.IGNORECASE)
    return int(m.group(1)) if m else None

def get_available_archive_pdfs(storage_client):
    """Finds all PDFs in the archive directory and filters out protected wards."""
    archive_bucket = storage_client.bucket(ARCHIVE_BUCKET_NAME)
    prefix = f"{DATASET_NAME}/updated_pdf_without_photo/"
    blobs = list(archive_bucket.list_blobs(prefix=prefix))
    
    target_blobs = []
    for b in blobs:
        if not b.name.endswith('.pdf'):
            continue
        fname = os.path.basename(b.name)
        w = extract_ward_number(fname)
        if w is None:
            continue
        if w in PROTECTED_WARDS:
            continue
        target_blobs.append((w, b))
        
    # Sort by ward number
    target_blobs.sort(key=lambda x: x[0])
    return target_blobs

def copy_to_queue(storage_client, target_blobs):
    """Copies target PDFs from the archive folder to the input queue bucket."""
    input_bucket = storage_client.bucket(INPUT_BUCKET_NAME)
    copied = []
    for ward, blob in target_blobs:
        fname = os.path.basename(blob.name)
        queue_path = f"queue/{DATASET_NAME}/{fname}"
        
        # Check if already in queue
        dest_blob = input_bucket.blob(queue_path)
        if not dest_blob.exists():
            print(f"📥 Copying Ward {ward:2d} ({fname}) -> gs://{INPUT_BUCKET_NAME}/{queue_path}...")
            blob.bucket.copy_blob(blob, input_bucket, queue_path)
        else:
            print(f"ℹ️ Ward {ward:2d} ({fname}) already present in queue.")
            
        copied.append((ward, dest_blob))
    return copied

def sync_ward_json(json_path: str, ward: int):
    """Safely syncs a single ward JSON to SQLite, ensuring other wards are completely untouched."""
    if not os.path.exists(json_path):
        return 0
        
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    active_voters = [v for v in data if not v.get('is_deleted_or_shifted')]
    
    # Scoped delete ONLY for this specific ward
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('DELETE FROM voters WHERE ward = ?', (ward,))
        conn.commit()
        
    # Insert clean active voters
    inserted = insert_voters(active_voters)
    print(f"✅ Ward {ward} DB Sync Complete: {inserted} active voters.")
    return inserted

def main():
    parser = argparse.ArgumentParser(description="Fully Automated End-to-End OCR & Sync Pipeline.")
    parser.add_argument("--batch", type=int, default=None, help="Number of wards to process in this run (e.g. 5).")
    parser.add_argument("--ward", type=int, default=None, help="Process a single specific ward.")
    parser.add_argument("--dry-run", action="store_true", help="List target wards without copying or extracting.")
    parser.add_argument("--skip-recheck", action="store_true", help="Skip the recheck step after sync.")
    args = parser.parse_args()

    print("==================================================================")
    print("🚀 AUTOMATED OCR & SYNC PIPELINE (Gemini 2.5 Flash)")
    print(f"🔒 Protected Wards (Strictly Skipped): {sorted(list(PROTECTED_WARDS))}")
    print("==================================================================")

    storage_client = storage.Client()
    available_targets = get_available_archive_pdfs(storage_client)

    if not available_targets:
        print("No target wards found to process.")
        return

    # Filter for single ward if specified
    if args.ward is not None:
        if args.ward in PROTECTED_WARDS:
            print(f"❌ Error: Ward {args.ward} is in the PROTECTED_WARDS list. Aborting.")
            return
        available_targets = [t for t in available_targets if t[0] == args.ward]
        if not available_targets:
            print(f"Ward {args.ward} not found in archive.")
            return

    # Apply batch limit if specified
    if args.batch:
        available_targets = available_targets[:args.batch]

    target_ward_numbers = [t[0] for t in available_targets]
    print(f"\n📋 Target Wards for This Run ({len(available_targets)} wards): {target_ward_numbers}")

    if args.dry_run:
        print("\n[DRY RUN] No actions taken.")
        return

    # 1. Initialize Gemini Client
    try:
        credentials, project_id = google.auth.default()
        client = genai.Client(vertexai=True, project=project_id, location='us-central1')
    except Exception as e:
        print(f"Authentication error: {e}")
        return

    # 2. Copy PDFs to queue
    input_bucket = storage_client.bucket(INPUT_BUCKET_NAME)
    output_bucket = storage_client.bucket(OUTPUT_BUCKET_NAME)
    queued_blobs = copy_to_queue(storage_client, available_targets)

    # 3. Process each ward in the queue
    print(f"\n⚡ Beginning Extraction for {len(queued_blobs)} wards...")
    summary_results = {}

    for ward, blob in queued_blobs:
        print(f"\n------------------------------------------------------------")
        print(f"▶️ Processing Ward {ward}...")
        print(f"------------------------------------------------------------")
        try:
            # Process extraction & archiving
            process_blob(blob, input_bucket, output_bucket, client, start_page=3)
            
            # Sync to local DB
            fname = os.path.basename(blob.name)
            output_json_path = f"/tmp/{fname.replace('.pdf', '_voters.json')}"
            inserted = sync_ward_json(output_json_path, ward)
            
            # Optional quick audit
            if not args.skip_recheck:
                print(f"\n🔍 Auditing Ward {ward}...")
                run_recheck(target_ward=ward)
                
            summary_results[ward] = {'status': 'SUCCESS', 'active_voters': inserted}
            
        except Exception as e:
            print(f"❌ Error processing Ward {ward}: {e}")
            summary_results[ward] = {'status': 'FAILED', 'error': str(e)}

    # 4. Final Pipeline Summary
    print("\n==================================================================")
    print("📊 PIPELINE EXECUTION SUMMARY")
    print("==================================================================")
    for w, res in sorted(summary_results.items()):
        if res['status'] == 'SUCCESS':
            print(f"Ward {w:2d}: ✅ SUCCESS ({res['active_voters']} active voters synced)")
        else:
            print(f"Ward {w:2d}: ❌ FAILED ({res.get('error')})")
    print("==================================================================")

if __name__ == "__main__":
    main()

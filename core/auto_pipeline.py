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
from ai_config import get_genai_client, get_model_name

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
            print(f"[COPY] Copying Ward {ward:2d} ({fname}) -> gs://{INPUT_BUCKET_NAME}/{queue_path}...")
            blob.bucket.copy_blob(blob, input_bucket, queue_path)
        else:
            print(f"[INFO] Ward {ward:2d} ({fname}) already present in queue.")
            
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
    print(f"[OK] Ward {ward} DB Sync Complete: {inserted} active voters.")
    return inserted

# State file to track completed wards across pipeline runs
STATE_FILE = os.path.join(os.path.dirname(__file__), ".pipeline_state.json")

def load_completed_wards() -> set:
    """Loads the set of already completed wards from the local state file."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return set(data.get("completed_wards", []))
        except Exception:
            return set()
    return set()

def save_completed_ward(ward: int):
    """Persists a completed ward to the local state file."""
    completed = load_completed_wards()
    completed.add(ward)
    try:
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump({"completed_wards": sorted(list(completed))}, f, indent=2)
    except Exception as e:
        print(f"[WARNING] Could not save state: {e}")

def parse_ward_list(ward_str: str) -> set:
    """Parses a comma-separated list of wards and ranges (e.g. '17,18,20-25')."""
    wards = set()
    for part in ward_str.split(','):
        part = part.strip()
        if '-' in part:
            try:
                s, e = part.split('-', 1)
                wards.update(range(int(s), int(e) + 1))
            except ValueError:
                pass
        elif part.isdigit():
            wards.add(int(part))
    return wards

def main():
    parser = argparse.ArgumentParser(description="Fully Automated End-to-End OCR & Sync Pipeline.")
    parser.add_argument("--batch", type=int, default=None, help="Number of wards to process in this run (e.g. 5).")
    parser.add_argument("--ward", type=int, default=None, help="Process a single specific ward.")
    parser.add_argument("--start-ward", type=int, default=None, help="Start processing from this ward number onwards (e.g. --start-ward 17).")
    parser.add_argument("--wards", type=str, default=None, help="Specific wards or ranges to process (e.g. '17-55' or '17,18,20-25').")
    parser.add_argument("--exclude", type=str, default=None, help="Wards or ranges to exclude (e.g. '2,4,7-16').")
    parser.add_argument("--force", action="store_true", help="Force re-extraction even if ward is recorded in state file.")
    parser.add_argument("--dry-run", action="store_true", help="List target wards without copying or extracting.")
    parser.add_argument("--skip-recheck", action="store_true", help="Skip the recheck step after sync.")
    args = parser.parse_args()

    print("==================================================================")
    print("[START] AUTOMATED OCR & SYNC PIPELINE (Gemini 2.5 Flash)")
    print(f"Protected Wards (Strictly Skipped): {sorted(list(PROTECTED_WARDS))}")
    print("==================================================================")

    storage_client = storage.Client()
    available_targets = get_available_archive_pdfs(storage_client)

    if not available_targets:
        print("No target wards found to process.")
        return

    # Filter out wards already completed in previous runs
    completed = load_completed_wards()
    if completed and not args.force:
        print(f"[INFO] Skipping {len(completed)} ward(s) previously completed: {sorted(list(completed))}")
        available_targets = [t for t in available_targets if t[0] not in completed]

    # Filter for single ward if specified
    if args.ward is not None:
        if args.ward in PROTECTED_WARDS:
            print(f"[ERROR] Ward {args.ward} is in the PROTECTED_WARDS list. Aborting.")
            return
        available_targets = [t for t in available_targets if t[0] == args.ward]
        if not available_targets:
            print(f"Ward {args.ward} not found or already completed.")
            return

    # Filter by start ward
    if args.start_ward is not None:
        available_targets = [t for t in available_targets if t[0] >= args.start_ward]

    # Filter by specific wards or ranges
    if args.wards is not None:
        selected_wards = parse_ward_list(args.wards)
        available_targets = [t for t in available_targets if t[0] in selected_wards]

    # Exclude specific wards
    if args.exclude is not None:
        excluded_wards = parse_ward_list(args.exclude)
        available_targets = [t for t in available_targets if t[0] not in excluded_wards]

    # Apply batch limit if specified
    if args.batch:
        available_targets = available_targets[:args.batch]

    target_ward_numbers = [t[0] for t in available_targets]
    print(f"\n[QUEUE] Target Wards for This Run ({len(available_targets)} wards): {target_ward_numbers}")

    if args.dry_run:
        print("\n[DRY RUN] No actions taken.")
        return

    # 1. Initialize Gemini Client
    try:
        client = get_genai_client()
    except Exception as e:
        print(f"Authentication error: {e}")
        return

    # 2. Copy PDFs to queue
    input_bucket = storage_client.bucket(INPUT_BUCKET_NAME)
    output_bucket = storage_client.bucket(OUTPUT_BUCKET_NAME)
    queued_blobs = copy_to_queue(storage_client, available_targets)

    # 3. Process each ward in the queue
    print(f"\n[START] Beginning Extraction for {len(queued_blobs)} wards...")
    summary_results = {}

    for ward, blob in queued_blobs:
        print(f"\n------------------------------------------------------------")
        print(f"[RUN] Processing Ward {ward}...")
        print(f"------------------------------------------------------------")
        try:
            # Process extraction & archiving
            process_blob(blob, input_bucket, output_bucket, client, start_page=3)
            
            # Sync to local DB
            fname = os.path.basename(blob.name)
            output_json_path = f"/tmp/{fname.replace('.pdf', '_voters.json')}"
            inserted = sync_ward_json(output_json_path, ward)
            
            # Record in persistent state file
            save_completed_ward(ward)
            
            # Optional quick audit
            if not args.skip_recheck:
                print(f"\n[AUDIT] Auditing Ward {ward}...")
                run_recheck(target_ward=ward)
                
            summary_results[ward] = {'status': 'SUCCESS', 'active_voters': inserted}
            
        except Exception as e:
            print(f"[ERROR] Failed processing Ward {ward}: {e}")
            summary_results[ward] = {'status': 'FAILED', 'error': str(e)}

    # 4. Final Pipeline Summary
    print("\n==================================================================")
    print("=== PIPELINE EXECUTION SUMMARY ===")
    print("==================================================================")
    for w, res in sorted(summary_results.items()):
        if res['status'] == 'SUCCESS':
            print(f"Ward {w:2d}: [OK] SUCCESS ({res['active_voters']} active voters synced)")
        else:
            print(f"Ward {w:2d}: [FAIL] FAILED ({res.get('error')})")
    print("==================================================================")

if __name__ == "__main__":
    main()

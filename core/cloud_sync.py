import os
import json
import argparse
from google.cloud import storage

# Ensure we can import database from the same directory
import sys
sys.path.append(os.path.dirname(__file__))
from database import init_db, insert_voters

INPUT_BUCKET_NAME = os.environ.get("INPUT_BUCKET", "ocr-voter-lists-input")
OUTPUT_BUCKET_NAME = os.environ.get("OUTPUT_BUCKET", "ocr-voter-lists-output")

def sync_dataset(dataset_name):
    print(f"Syncing dataset '{dataset_name}' from GCS Output Bucket to Local Database...")
    
    init_db()
    
    storage_client = storage.Client()
    output_bucket = storage_client.bucket(OUTPUT_BUCKET_NAME)
    
    prefix = f"{dataset_name}/"
    blobs = list(output_bucket.list_blobs(prefix=prefix))
    json_blobs = [b for b in blobs if b.name.endswith('.json')]
    
    if not json_blobs:
        print(f"No JSON files found in gs://{OUTPUT_BUCKET_NAME}/{prefix}")
        return
        
    print(f"Found {len(json_blobs)} verified files. Downloading and syncing...")
    
    total_inserted = 0
    
    for blob in json_blobs:
        print(f"  Downloading {blob.name}...")
        json_data = blob.download_as_string()
        
        try:
            voters_list = json.loads(json_data)
            print(f"  Syncing {len(voters_list)} voters to local DB...")
            inserted_count = insert_voters(voters_list)
            total_inserted += len(voters_list) # insert_voters does upserts
        except json.JSONDecodeError:
            print(f"  [ERROR] Failed to parse JSON from {blob.name}")
            
    print(f"\n[SUCCESS] Sync complete! Synced roughly {total_inserted} voter records from the cloud to your local database.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download verified JSON from GCS and insert into local SQLite DB.")
    parser.add_argument("--dataset", type=str, default="nagar_parishad", help="The name of the dataset folder (e.g. nagar_parishad)")
    args = parser.parse_args()
    
    sync_dataset(args.dataset)

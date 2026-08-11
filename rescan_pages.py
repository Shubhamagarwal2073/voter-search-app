import os
import argparse
import time
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
import google.auth
from google.auth.exceptions import DefaultCredentialsError
from extractor import extract_from_chunk
from database import init_db, insert_voters

def parse_specific_pages(pdf_path: str, pages_to_scan: list, ward: int = None):
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return []

    try:
        credentials, project_id = google.auth.default()
        print(f"Authenticated via Google Cloud. Project ID: {project_id}")
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Credentials not found.")
        return []

    client = genai.Client(vertexai=True, project=project_id, location='us-central1')
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    
    print(f"Found {total_pages} pages. Extracting specifically pages: {pages_to_scan}")
    
    all_voters = []
    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    
    for page_num in pages_to_scan:
        if page_num < 1 or page_num > total_pages:
            print(f"Skipping invalid page {page_num}")
            continue
            
        page = reader.pages[page_num - 1]
        writer = PdfWriter()
        writer.add_page(page)
            
        temp_pdf = temp_dir / f"page_{page_num}.pdf"
        with open(temp_pdf, "wb") as f:
            writer.write(f)
            
        try:
            # We use extract_from_chunk from extractor.py which has the tight prompt
            voters = extract_from_chunk(client, str(temp_pdf), page_num, page_num)
            print(f"  -> Extracted {len(voters)} voters from page {page_num}.")
            source_filename = os.path.basename(pdf_path)
            filtered_voters = []
            for v in voters:
                # Ensure the serial number is strictly greater than 1348
                try:
                    sn = int(v.get('serial_number', 0))
                    if sn <= 1348:
                        print(f"    Skipping serial {sn} (must be > 1348)")
                        continue
                except ValueError:
                    continue
                
                # FIX: If voter_id is empty, they will all conflict and overwrite each other!
                # Give them a temporary unique ID if they don't have one on the printed page.
                if not v.get('voter_id') or str(v.get('voter_id')).strip() == "":
                    v['voter_id'] = f"TEMP_ID_{sn}"
                
                if ward is not None:
                    v['ward'] = ward
                v['source_file'] = source_filename
                filtered_voters.append(v)
                
            all_voters.extend(filtered_voters)
            
            # This uses the UPSERT logic in database.py
            insert_voters(filtered_voters)
            
        except Exception as e:
            print(f"Failed to process page {page_num}: {e}")
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()
                
        # Sleep to respect rate limits
        if page_num != pages_to_scan[-1]:
            time.sleep(4.5)

    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    return all_voters

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", help="Path to PDF")
    parser.add_argument("--ward", type=int, default=5)
    args = parser.parse_args()

    init_db()
    
    target_pages = [55, 56]
    parse_specific_pages(args.pdf_path, target_pages, args.ward)
    print("Specific page rescanning complete for new entries (> 1348)!")

if __name__ == "__main__":
    main()

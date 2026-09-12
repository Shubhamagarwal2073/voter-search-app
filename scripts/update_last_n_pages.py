import os
import argparse
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
import google.auth
from google.auth.exceptions import DefaultCredentialsError

import sys
# Add core to path so we can import the existing logic
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'core'))
from database import init_db, get_connection
from extractor import extract_from_chunk

def delete_voter(voter_id, ward, serial_number):
    """Deletes a voter from the database if they were marked as DELETED or SHIFTED."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # If the voter_id is a temporary one (meaning the LLM couldn't read the real one due to the DELETED stamp),
        # we MUST delete by ward and serial_number instead.
        if voter_id and not str(voter_id).startswith("TEMP_ID"):
            cursor.execute('DELETE FROM voters WHERE voter_id = ?', (voter_id,))
        else:
            cursor.execute('DELETE FROM voters WHERE ward = ? AND serial_number = ?', (ward, serial_number))
            
        conn.commit()
        if cursor.rowcount > 0:
            print(f"      [DELETED] Removed voter (voter_id: {voter_id}, S.N: {serial_number}) from database.")
        else:
            print(f"      [WARNING] Deletion failed. Voter not found in DB (voter_id: {voter_id}, S.N: {serial_number}).")

def update_voters(voters_list: list):
    """Updates existing voters or inserts new ones (overrides old data)."""
    if not voters_list:
        return 0
        
    inserted_count = 0
    with get_connection() as conn:
        cursor = conn.cursor()
        for voter in voters_list:
            try:
                cursor.execute('''
                    INSERT INTO voters 
                    (ward, serial_number, voter_id, name_hi, relative_name_hi, relative_type, house_number, age, gender, page_number, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(voter_id) DO UPDATE SET
                        ward=excluded.ward,
                        serial_number=excluded.serial_number,
                        name_hi=excluded.name_hi,
                        relative_name_hi=excluded.relative_name_hi,
                        relative_type=excluded.relative_type,
                        house_number=excluded.house_number,
                        age=excluded.age,
                        gender=excluded.gender,
                        page_number=excluded.page_number,
                        source_file=excluded.source_file
                ''', (
                    voter.get('ward'),
                    voter.get('serial_number'),
                    voter.get('voter_id'),
                    voter.get('name_hi'),
                    voter.get('relative_name_hi'),
                    voter.get('relative_type'),
                    voter.get('house_number'),
                    voter.get('age'),
                    voter.get('gender'),
                    voter.get('page_number'),
                    voter.get('source_file')
                ))
                inserted_count += 1
            except Exception as e:
                print(f"      [ERROR] inserting {voter.get('voter_id')}: {e}")
        conn.commit()
    return inserted_count


def parse_last_n_pages(pdf_path: str, ward: int, last_n_pages: int):
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return

    try:
        credentials, project_id = google.auth.default()
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Credentials not found.")
        return

    client = genai.Client(vertexai=True, project=project_id, location='us-central1')
    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    
    start_page_arg = max(1, total_pdf_pages - last_n_pages + 1)
    
    print(f"\nStarting {os.path.basename(pdf_path)} (Ward {ward})")
    print(f"Total Pages: {total_pdf_pages} | Extracting LAST {last_n_pages} pages (Pages {start_page_arg} to {total_pdf_pages})...")
    
    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    
    for i in range(start_page_arg - 1, total_pdf_pages):
        chunk_page = reader.pages[i]
        page_num = i + 1
        
        writer = PdfWriter()
        writer.add_page(chunk_page)
            
        temp_pdf = temp_dir / f"page_{page_num}.pdf"
        with open(temp_pdf, "wb") as f:
            writer.write(f)
            
        try:
            print(f"\n  Processing Page {page_num}...")
            voters = extract_from_chunk(client, str(temp_pdf), page_num, page_num)
            source_filename = os.path.basename(pdf_path)
            
            valid_voters = []
            deleted_count = 0
            
            for v in voters:
                # Clean strings
                for key, value in v.items():
                    if isinstance(value, str):
                        v[key] = value.strip()
                        
                voter_id = v.get('voter_id')
                
                # Check for S, E, R prefixes
                sn_str = str(v.get('serial_number', '')).strip().upper()
                faulty_prefixes = ('S', 'E', 'R')
                has_faulty_prefix = any(sn_str.startswith(p) for p in faulty_prefixes)
                
                # 1. AI Flag: Did the LLM explicitly flag it as deleted/shifted? (Delete stamp)
                ai_flagged_deleted = v.get('is_deleted_or_shifted', False)
                
                if ai_flagged_deleted or has_faulty_prefix:
                    # Clean the serial number for the DB query
                    clean_sn_str = sn_str
                    for p in faulty_prefixes:
                        clean_sn_str = clean_sn_str.replace(p, '')
                    clean_sn_str = clean_sn_str.replace('-', '').strip()
                    
                    try:
                        clean_sn = int(clean_sn_str)
                    except ValueError:
                        clean_sn = 0
                        
                    # We pass the original voter_id (which might be None) so it falls back to ward+sn if needed
                    delete_voter(voter_id, ward, clean_sn)
                    deleted_count += 1
                    continue
                
                # If they pass all checks, they are a valid new user!
                # Give them a temporary voter_id if they don't have one
                if not voter_id:
                    voter_id = f"TEMP_ID_W{ward}_{v.get('serial_number', 0)}"
                    v['voter_id'] = voter_id
                
                v['ward'] = ward
                v['source_file'] = source_filename
                valid_voters.append(v)
                
            inserted_count = update_voters(valid_voters)
            print(f"    -> Status: {inserted_count} Overwritten/Inserted | {deleted_count} Deleted")
            
        except Exception as e:
            print(f"    -> [FATAL ERROR] Failed to process page {page_num}: {e}")
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()
                
    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    print(f"\nFinished processing Ward {ward}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update existing SQLite database using ONLY the last N pages of a PDF.")
    parser.add_argument("pdf_path", help="Path to PDF")
    parser.add_argument("--ward", type=int, required=True, help="Ward Number")
    parser.add_argument("--last-n-pages", type=int, required=True, help="Process ONLY the last N pages (e.g. 8)")
    args = parser.parse_args()

    init_db()
    parse_last_n_pages(args.pdf_path, args.ward, args.last_n_pages)

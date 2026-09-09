import os
import json
import argparse
import time
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import APIError, ClientError
from database import init_db, insert_voters
from concurrent.futures import ThreadPoolExecutor, as_completed

import google.auth
from google.auth.exceptions import DefaultCredentialsError

import io

# Retry decorator for handling transient API errors automatically
@retry(
    retry=retry_if_exception_type((APIError, ClientError)),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(5)
)
def extract_from_chunk(client, pdf_path, start_page, end_page):
    print(f"Extracting page {start_page} in halves...")
    
    response_schema = types.Schema(
        type=types.Type.ARRAY,
        items=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "serial_number": types.Schema(type=types.Type.INTEGER, description="The exact Serial Number digits written in the top-left box. Strip any 'S' prefix."),
                "voter_id": types.Schema(type=types.Type.STRING, description="The unique voter ID, e.g. SSB1340801"),
                "name_hi": types.Schema(type=types.Type.STRING, description="Name of the voter in Hindi"),
                "relative_name_hi": types.Schema(type=types.Type.STRING, description="Name of the father or husband in Hindi"),
                "relative_type": types.Schema(type=types.Type.STRING, description="'father' if 'पिता' is present, 'husband' if 'पति' is present"),
                "house_number": types.Schema(type=types.Type.STRING, description="House number"),
                "age": types.Schema(type=types.Type.INTEGER, description="Age of the voter"),
                "gender": types.Schema(type=types.Type.STRING, description="'male', 'female', or 'other' based on 'पुरुष' / 'स्त्री' / 'तृतीय लिंग'"),
                "page_number": types.Schema(type=types.Type.INTEGER, description="The page number where this record was found"),
                "is_deleted_or_shifted": types.Schema(type=types.Type.BOOLEAN, description="True ONLY IF the box has a 'DELETED' stamp, OR the serial number starts with an 'S' prefix. False otherwise.")
            },
            required=["serial_number", "voter_id", "name_hi", "age"]
        )
    )

    base_prompt = f"""
    You are an expert at extracting structured data from Indian Electoral Rolls (Voter Lists) in Hindi.
    Extract EVERY SINGLE grid box entry and return it as a JSON array of objects. Do not skip any boxes!
    
    CRITICAL RULE 1: If a grid box has the word 'DELETED' stamped across it, OR if the Serial Number has an 'S' prefix (e.g. 'S 1346'), you MUST set the "is_deleted_or_shifted" flag to true.
    
    CRITICAL RULE 2 (SPELLING AND GRAMMAR): 
    - You must extract the Hindi names with 100% absolute precision. Pay strict attention to all matras (vowel signs). Do not guess or auto-correct the names.
    - For gender, strictly look at the text 'पुरुष' (male), 'स्त्री' (female), or 'तृतीय लिंग' (other). Do NOT guess the gender based on the name.
    
    CRITICAL RULE 3 (SUMMARY TABLES):
    At the bottom of the final pages, there is often a summary table (e.g. "परिवर्धन की", "कुल"). You must IGNORE this summary table, but you MUST NOT skip the voter grid boxes located directly above it! Extract every single voter.
    
    CRITICAL RULE 4 (VILOPAN SUCHI / DELETIONS LIST):
    The final pages contain supplements. If a voter box is located under the header "विलोपन सूची" (Vilopan Suchi / Deletions List), you MUST set "is_deleted_or_shifted" to true! Only boxes under "परिवर्धन सूची" (Additions) should be false.
    
    PAY CLOSE ATTENTION to the top of each grid box, there are TWO distinct numbers:
    1. The Serial Number (क्रम संख्या): Located in a small box at the top left. Read the actual digits perfectly.
    2. The Voter ID (EPIC Number): Located next to the serial number or at the top right (e.g. SSB0996546). DO NOT confuse the Serial Number with the Voter ID.
    
    Also capture the Name, Father/Husband's name, House No., Age, and Gender.
    Translate the gender to English ('male', 'female', 'other').
    Set the page_number field to {start_page}.
    """

    reader = PdfReader(pdf_path)
    page_top = reader.pages[0]
    
    upper_right = page_top.mediabox.upper_right
    lower_left = page_top.mediabox.lower_left
    # Add a slight overlap (e.g. 55% instead of 50%) to ensure boxes in the middle aren't cut
    mid_y_top = lower_left[1] + (upper_right[1] - lower_left[1]) * 0.45 
    mid_y_bottom = lower_left[1] + (upper_right[1] - lower_left[1]) * 0.55
    
    # Process TOP HALF
    page_top.mediabox.lower_left = (lower_left[0], mid_y_top)
    writer_top = PdfWriter()
    writer_top.add_page(page_top)
    pdf_bytes_top = io.BytesIO()
    writer_top.write(pdf_bytes_top)
    
    response_top = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(data=pdf_bytes_top.getvalue(), mime_type='application/pdf'),
            base_prompt + "\nCarefully read the TOP HALF of the page provided."
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.1
        )
    )
    
    # Re-read for BOTTOM HALF
    reader_bottom = PdfReader(pdf_path)
    page_bottom = reader_bottom.pages[0]
    page_bottom.mediabox.upper_right = (upper_right[0], mid_y_bottom)
    
    writer_bottom = PdfWriter()
    writer_bottom.add_page(page_bottom)
    pdf_bytes_bottom = io.BytesIO()
    writer_bottom.write(pdf_bytes_bottom)
    
    response_bottom = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(data=pdf_bytes_bottom.getvalue(), mime_type='application/pdf'),
            base_prompt + "\nCarefully read the BOTTOM HALF of the page provided."
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.1
        )
    )
    
    try:
        voters_top = json.loads(response_top.text)
    except:
        voters_top = []
        
    try:
        voters_bottom = json.loads(response_bottom.text)
    except:
        voters_bottom = []
        
    # De-duplicate any middle boxes that might have been caught in the overlap
    all_voters = voters_top + voters_bottom
    unique_voters = {v['serial_number']: v for v in all_voters if v.get('serial_number')}.values()
    
    return list(unique_voters)


def parse_pdf(pdf_path: str, ward: int = None, start_page_arg: int = 1, end_page_arg: int = None):
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return []

    try:
        credentials, project_id = google.auth.default()
        print(f"Authenticated via Google Cloud. Project ID: {project_id}")
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Credentials not found.")
        print("Please run: gcloud auth application-default login")
        return []

    # Initialize Vertex AI Client (Permanent, enterprise-tier)
    client = genai.Client(
        vertexai=True, 
        project=project_id, 
        location='us-central1'
    )
    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    
    actual_end_page = end_page_arg if end_page_arg is not None else total_pdf_pages
    
    print(f"Found {total_pdf_pages} pages in PDF. Processing from page {start_page_arg} to {actual_end_page}...")
    
    all_voters = []
    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    
    batch_size = 1

    def process_page(i):
        # Create a local reader for thread safety
        local_reader = PdfReader(pdf_path)
        chunk_pages = local_reader.pages[i:i+batch_size]
        start_page = i + 1
        end_page = i + len(chunk_pages)
        
        writer = PdfWriter()
        for page in chunk_pages:
            writer.add_page(page)
            
        temp_pdf = temp_dir / f"pages_{start_page}_to_{end_page}.pdf"
        with open(temp_pdf, "wb") as f:
            writer.write(f)
            
        try:
            voters = extract_from_chunk(client, str(temp_pdf), start_page, end_page)
            print(f"  -> Extracted {len(voters)} voters from page {start_page}.")
            source_filename = os.path.basename(pdf_path)
            valid_voters = []
            for v in voters:
                if v.get('is_deleted_or_shifted', False):
                    continue
                
                for key, value in v.items():
                    if isinstance(value, str):
                        v[key] = value.strip()
                    
                if not v.get('voter_id') or str(v.get('voter_id')) == "":
                    sn = v.get('serial_number', 0)
                    ward_str = str(ward) if ward is not None else "0"
                    clean_name = source_filename.replace('.pdf', '').replace(' ', '_').replace('-', '_')
                    pg = v.get('page_number', 0)
                    v['voter_id'] = f"TEMP_W{ward_str}_{clean_name}_P{pg}_S{sn}"
                
                if ward is not None:
                    v['ward'] = ward
                v['source_file'] = source_filename
                
                valid_voters.append(v)
                
            print(f"  -> Successfully kept {len(valid_voters)} valid voters from page {start_page}.")
            return valid_voters
        except Exception as e:
            print(f"Failed to process page {start_page}: {e}")
            return []
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(process_page, i) for i in range(start_page_arg - 1, actual_end_page, batch_size)]
        for future in as_completed(futures):
            valid_voters = future.result()
            if valid_voters:
                all_voters.extend(valid_voters)
                insert_voters(valid_voters)

    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    return all_voters

def main():
    parser = argparse.ArgumentParser(description="Extract Electoral Roll PDF data to SQLite.")
    parser.add_argument("pdf_path", help="Path to the PDF file to process.")
    parser.add_argument("--ward", type=int, help="Optional Ward Number to map these voters to.", default=None)
    parser.add_argument("--start-page", type=int, help="Page to start extraction from", default=1)
    parser.add_argument("--end-page", type=int, help="Page to end extraction at", default=None)
    args = parser.parse_args()

    init_db()
    
    # We call parse_pdf, which saves to DB iteratively
    parse_pdf(args.pdf_path, args.ward, args.start_page, args.end_page)
    print("Processing complete!")

if __name__ == "__main__":
    main()

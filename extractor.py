import os
import json
import argparse
import time
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import APIError
from database import init_db, insert_voters

import google.auth
from google.auth.exceptions import DefaultCredentialsError

# Retry decorator for handling transient API errors automatically
@retry(
    retry=retry_if_exception_type(APIError),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(5)
)
def extract_from_chunk(client, pdf_path, start_page, end_page):
    print(f"Extracting pages {start_page} to {end_page}...")
    
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    response_schema = types.Schema(
        type=types.Type.ARRAY,
        items=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "serial_number": types.Schema(type=types.Type.INTEGER, description="The exact Serial Number digits written in the top-left box. If it says 'S 1346', extract just the integer 1346."),
                "voter_id": types.Schema(type=types.Type.STRING, description="The unique voter ID, e.g. SSB1340801"),
                "name_hi": types.Schema(type=types.Type.STRING, description="Name of the voter in Hindi"),
                "relative_name_hi": types.Schema(type=types.Type.STRING, description="Name of the father or husband in Hindi"),
                "relative_type": types.Schema(type=types.Type.STRING, description="'father' if 'पिता' is present, 'husband' if 'पति' is present"),
                "house_number": types.Schema(type=types.Type.STRING, description="House number"),
                "age": types.Schema(type=types.Type.INTEGER, description="Age of the voter"),
                "gender": types.Schema(type=types.Type.STRING, description="'male', 'female', or 'other' based on 'पुरुष' / 'स्त्री' / 'तृतीय लिंग'"),
                "page_number": types.Schema(type=types.Type.INTEGER, description="The page number where this record was found")
            },
            required=["serial_number", "voter_id", "name_hi", "age"]
        )
    )

    prompt = f"""
    You are an expert at extracting structured data from Indian Electoral Rolls (Voter Lists) in Hindi.
    Carefully read the single page {start_page} provided.
    Extract every single valid voter entry and return it as a JSON array of objects.
    
    CRITICAL RULE 1: If a grid box has the word 'DELETED' (or similar crossing out) stamped across it, YOU MUST COMPLETELY SKIP IT.
    
    CRITICAL RULE 2 (SPELLING AND GRAMMAR): 
    - You must extract the Hindi names with 100% absolute precision. Pay strict attention to all matras (vowel signs). Do not guess or auto-correct the names.
    - For gender, strictly look at the text 'पुरुष' (male), 'स्त्री' (female), or 'तृतीय लिंग' (other). Do NOT guess the gender based on the name.
    
    PAY CLOSE ATTENTION to the top of each grid box, there are TWO distinct numbers:
    1. The Serial Number (क्रम संख्या): Located in a small box at the top left. Read the actual digits perfectly.
    2. The Voter ID (EPIC Number): Located next to the serial number or at the top right (e.g. SSB0996546). DO NOT confuse the Serial Number with the Voter ID.
    
    Also capture the Name, Father/Husband's name, House No., Age, and Gender.
    Translate the gender to English ('male', 'female', 'other').
    Set the page_number field to {start_page}.
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.1
        )
    )
    return json.loads(response.text)


def parse_pdf(pdf_path: str, ward: int = None):
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
    total_pages = min(len(reader.pages), 54)
    
    print(f"Found {len(reader.pages)} pages in PDF. Processing ONE page at a time up to page {total_pages} for maximum accuracy...")
    
    all_voters = []
    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    
    batch_size = 1

    for i in range(0, total_pages, batch_size):
        chunk_pages = reader.pages[i:i+batch_size]
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
            for v in voters:
                if ward is not None:
                    v['ward'] = ward
                v['source_file'] = source_filename
            all_voters.extend(voters)
            insert_voters(voters)
        except Exception as e:
            print(f"Failed to process page {start_page}: {e}")
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()
                
        # Sleep to respect the 15 RPM limit for the free tier
        if end_page < total_pages:
            time.sleep(4.5)

    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    return all_voters

def main():
    parser = argparse.ArgumentParser(description="Extract Electoral Roll PDF data to SQLite.")
    parser.add_argument("pdf_path", help="Path to the PDF file to process.")
    parser.add_argument("--ward", type=int, help="Optional Ward Number to map these voters to.", default=None)
    args = parser.parse_args()

    init_db()
    
    # We call parse_pdf, which saves to DB iteratively
    parse_pdf(args.pdf_path, args.ward)
    print("Processing complete!")

if __name__ == "__main__":
    main()

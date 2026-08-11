import os
import json
import argparse
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import APIError
from database import init_db, insert_voters

import google.auth
from google.auth.exceptions import DefaultCredentialsError

@retry(
    retry=retry_if_exception_type(APIError),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(5)
)
def extract_missing(client, pdf_path, start_page, end_page):
    print(f"Extracting specific missing voters from pages {start_page} to {end_page}...")
    
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
    Carefully read the grid boxes across pages {start_page} to {end_page} in this document chunk.
    
    CRITICAL INSTRUCTION: You must extract the voter information **ONLY** for the following specific Serial Numbers:
    [1342, 1353, 1354, 1355, 1356, 1357, 1358, 1359, 1360, 1361, 1362, 1363, 1364, 1365, 1366, 1367, 1368, 1369, 1370, 1371, 1372, 1373, 1374]
    
    DO NOT extract any other serial numbers. Skip them completely.
    If none of these specific serial numbers are found on the page, return an empty array [].
    
    PAY CLOSE ATTENTION to the top of each grid box, there are TWO distinct numbers:
    1. The Serial Number (क्रम संख्या): Located in a small box at the top left.
    2. The Voter ID (EPIC Number): Located next to the serial number or at the top right (e.g. SSB0996546).
    DO NOT confuse the Serial Number with the Voter ID.
    
    Also capture the Name, Father/Husband's name, House No., Age, and Gender.
    Translate the gender to English ('male', 'female', 'other').
    Set the page_number field to the actual page number where you found each record.
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


def parse_target_pdf(pdf_path: str, ward: int = None):
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return []

    try:
        credentials, project_id = google.auth.default()
        print(f"Authenticated via Google Cloud. Project ID: {project_id}")
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Credentials not found.")
        return []

    client = genai.Client(
        vertexai=True, 
        project=project_id, 
        location='us-central1'
    )
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    
    print(f"Found {total_pages} pages in PDF. Extracting targeted missing voters from the last 5 pages...")
    
    # Missing voters are 1342, 1353-1374, which are all at the very end of the document.
    # We will just feed the last 5 pages to the AI in one chunk.
    start_page = total_pages - 5 + 1
    if start_page < 1: start_page = 1
    end_page = total_pages
    
    chunk_pages = reader.pages[start_page-1:end_page]
    
    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    temp_pdf = temp_dir / f"target_pages_{start_page}_to_{end_page}.pdf"
    
    writer = PdfWriter()
    for page in chunk_pages:
        writer.add_page(page)
        
    with open(temp_pdf, "wb") as f:
        writer.write(f)
        
    all_voters = []
    try:
        voters = extract_missing(client, str(temp_pdf), start_page, end_page)
        print(f"  -> Extracted {len(voters)} targeted voters from pages {start_page}-{end_page}.")
        source_filename = os.path.basename(pdf_path)
        for v in voters:
            if ward is not None:
                v['ward'] = ward
            v['source_file'] = source_filename
        all_voters.extend(voters)
        insert_voters(voters)
    except Exception as e:
        print(f"Failed to process targeted pages: {e}")
    finally:
        if temp_pdf.exists():
            temp_pdf.unlink()

    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    return all_voters

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", help="Path to the PDF file to process.")
    parser.add_argument("--ward", type=int, help="Optional Ward Number.", default=None)
    args = parser.parse_args()

    init_db()
    parse_target_pdf(args.pdf_path, args.ward)
    print("Targeted processing complete!")

if __name__ == "__main__":
    main()

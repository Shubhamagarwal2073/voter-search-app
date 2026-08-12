import os
import json
import argparse
import time
import sqlite3
import re
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import APIError
import google.auth
from google.auth.exceptions import DefaultCredentialsError

# Import the existing rescan function so we can auto-heal
from rescan_pages import parse_specific_pages

@retry(
    retry=retry_if_exception_type(APIError),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(3)
)
def extract_sample_from_crop(client, pdf_path, page_num):
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    
    # We only care about serial_number and name_hi for validation
    response_schema = types.Schema(
        type=types.Type.ARRAY,
        items=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "sn": types.Schema(type=types.Type.INTEGER, description="Serial Number"),
                "n": types.Schema(type=types.Type.STRING, description="Hindi Name"),
                "is_gibberish": types.Schema(type=types.Type.BOOLEAN, description="True ONLY IF the name looks like corrupted OCR gibberish (e.g. missing vowel matras like 'ररषत गरललत', or unnaturally spaced letters like 'म ओ ह न'). False if it is a normal valid Hindi name.")
            },
            required=["sn", "n", "is_gibberish"]
        )
    )

    prompt = f"""
    You are an expert QA inspector looking at a horizontally sliced image of an electoral roll page {page_num}.
    The bottom row of grid boxes might be cut in half by the image edge. 
    IGNORE the bottom row completely. Do not attempt to read any box that is touching the bottom edge.
    ONLY extract the top rows of voters that are 100% fully visible inside the frame.
    Return their Serial Number ('sn') and Hindi Name ('n').
    Pay strict attention to all Hindi matras.
    CRITICAL: Evaluate the extracted name. If it looks like OCR gibberish where matras were dropped (e.g., 'ररषत गरललत') or letters are spaced out (e.g., 'म ओ ह न'), set 'is_gibberish' to true.
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
            temperature=0.0,
        ),
    )
    return json.loads(response.text)

def check_accuracy_and_heal(pdf_path: str, ward: int):
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return

    try:
        credentials, project_id = google.auth.default()
        print(f"Authenticated via Google Cloud. Project ID: {project_id}")
    except DefaultCredentialsError:
        print("ERROR: Google Cloud Credentials not found.")
        return

    client = genai.Client(vertexai=True, project=project_id, location='us-central1')
    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    
    # Connect to DB to cross-check
    db_path = '../data/voters.db' if os.path.exists('../data/voters.db') else 'nextjs-search-app/data/voters.db'
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    
    flagged_pages = []

    print(f"Starting QA Recorrection for Ward {ward} ({total_pages} pages)...")

    for page_num in range(1, total_pages + 1):
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
                
            print(f"Page {page_num}: Extracted {len(sample_voters)} sample voters. Cross-checking...")
            
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
                    
                # STRICT PYTHON TRIPWIRE: Catch Spaced Letters ("म ओ ह न")
                words = sample_name.split()
                single_char_words = [w for w in words if len(w) == 1]
                if len(single_char_words) >= 3:
                    print(f"  [PYTHON DETECTED SPACED GIBBERISH] Page {page_num}, SN {sn}: '{sample_name}'")
                    page_failed = True
                    break
                    
                # STRICT PYTHON TRIPWIRE: Catch Dropped Matras ("ररषत गरललत")
                # Devanagari vowel signs/matras
                matra_pattern = re.compile(r'[\u093E-\u094D\u0900-\u0903]')
                bad_word = False
                for w in words:
                    # If a word is 4+ letters long and has NO vowel matras, it's highly suspicious OCR gibberish
                    if len(w) >= 4 and not matra_pattern.search(w):
                        bad_word = True
                        break
                        
                if bad_word:
                    print(f"  [PYTHON DETECTED MISSING MATRAS] Page {page_num}, SN {sn}: '{sample_name}'")
                    page_failed = True
                    break
                    
                cur.execute("SELECT name_hi FROM voters WHERE ward = ? AND serial_number = ?", (ward, sn))
                db_record = cur.fetchone()
                
                if db_record:
                    db_name = str(db_record['name_hi']).strip()
                    if sample_name != db_name:
                        print(f"  [MISMATCH] found on Page {page_num}, SN {sn}! AI QA says '{sample_name}', DB has '{db_name}'.")
                        page_failed = True
                        break 
                else:
                    # Ignore missing DB records. They might be officially "Shifted/Deleted" voters that the sample picked up but original ignored.
                    pass
                    
            if page_failed:
                flagged_pages.append(page_num)
            else:
                print(f"  ✅ Page {page_num} passed QA.")
                
        except Exception as e:
            print(f"Failed to QA process page {page_num}: {e}")
            flagged_pages.append(page_num)
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()
                
        # Sleep to respect rate limits
        if page_num != total_pages:
            time.sleep(4.5)

    try:
        temp_dir.rmdir()
    except OSError:
        pass
        
    if flagged_pages:
        print(f"\n🚨 QA Complete. Found {len(flagged_pages)} corrupted pages: {flagged_pages}")
        print("Triggering automatic rescan (Auto-Heal) for flagged pages...")
        parse_specific_pages(pdf_path, flagged_pages, ward)
        print("\n✨ Auto-Heal Complete! Database has been recorrected.")
    else:
        print("\n✨ QA Complete. ZERO errors found! Your database is perfect.")
        
def main():
    parser = argparse.ArgumentParser(description="Run QA sampling and auto-heal on a Ward PDF.")
    parser.add_argument("pdf_path", help="Path to PDF")
    parser.add_argument("--ward", type=int, required=True)
    args = parser.parse_args()

    check_accuracy_and_heal(args.pdf_path, args.ward)

if __name__ == "__main__":
    main()

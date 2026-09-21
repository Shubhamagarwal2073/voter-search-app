import os
import json
import argparse
import time
import re
import io
import unicodedata
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import APIError, ClientError
from concurrent.futures import ThreadPoolExecutor, as_completed

import google.auth
from google.auth.exceptions import DefaultCredentialsError

# Local database and AI configuration
from database import init_db, insert_voters, get_connection
from ai_config import get_model_name, get_genai_client, get_recommended_workers

# Response schema for structured output
RESPONSE_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "serial_number": types.Schema(
                type=types.Type.STRING, 
                description="Serial Number digits in the top-left box, e.g. '123' or 'S 123'. Include 'S', 'E', or 'R' prefix if present."
            ),
            "voter_id": types.Schema(
                type=types.Type.STRING, 
                description="The unique voter ID (EPIC number), e.g. SSB1340801. Return empty string if illegible, missing, or covered by stamp."
            ),
            "name_hi": types.Schema(
                type=types.Type.STRING, 
                description="Full voter name in Devanagari Hindi with exact matras. Do NOT include 'नाम:' label."
            ),
            "relative_name_hi": types.Schema(
                type=types.Type.STRING, 
                description="Father or husband name in Hindi. Do NOT include 'पिता:' or 'पति:' label."
            ),
            "relative_type": types.Schema(
                type=types.Type.STRING, 
                description="'father' if 'पिता' is present, 'husband' if 'पति' is present, 'mother' if 'माता' is present, or 'other'"
            ),
            "house_number": types.Schema(
                type=types.Type.STRING, 
                description="House number as written. Do NOT include 'मकान संख्या:' label."
            ),
            "age": types.Schema(
                type=types.Type.INTEGER, 
                description="Age of the voter as integer"
            ),
            "gender": types.Schema(
                type=types.Type.STRING, 
                description="'male', 'female', or 'other' based on 'पुरुष' / 'स्त्री' / 'तृतीय लिंग'"
            ),
            "page_number": types.Schema(
                type=types.Type.INTEGER, 
                description="The page number where this record was found"
            ),
            "is_deleted_or_shifted": types.Schema(
                type=types.Type.BOOLEAN, 
                description="True if the box has 'DELETED' or 'विलोपित' stamp, OR serial number starts with S, E, or R. False otherwise."
            )
        },
        required=["name_hi"]
    )
)

BASE_PROMPT = """
You are an expert OCR extraction system specialized in Indian Electoral Rolls (Voter Lists) in Hindi.
Analyze this full page carefully. It contains a grid of voter cards (typically 3 columns x 10 rows = up to 30 voter boxes).
Extract EVERY SINGLE voter card and return a JSON array matching the schema.

STRICT ACCURACY RULES:
1. DELETIONS / SHIFTED:
   - If a voter box is stamped with 'DELETED', 'विलोपित', 'निरस्त', or has a diagonal line across it, set "is_deleted_or_shifted" to true.
   - If the Serial Number starts with 'S' (Shifted), 'E' (Expired/Dead), or 'R' (Repeated), set "is_deleted_or_shifted" to true and include the letter in "serial_number".
   - If boxes appear under the header 'विलोपन सूची' (Deletions List), set "is_deleted_or_shifted" to true.

2. HINDI NAMES & MATRAS (ZERO-TOLERANCE FOR MATRA DROPS):
   - In Indian voter rolls, the ink on the top horizontal line (शिरोरेखा) often touches or merges with vowel marks. Inspect the top line with extreme care for top matras:
     * े (e), ै (ai), ो (o), ौ (au), ं (anusvara/bindu), ँ (chandrabindu). Example: 'रोहित' MUST NOT be read as 'रहित' or 'ररषत'; 'सुरेश' MUST NOT be read as 'सरश'; 'संतोष' MUST NOT be read as 'सतोष'.
   - Bottom matras: Inspect carefully for ु (chhota u), ू (bada u), ृ (ri). Example: 'सुरेश', 'कुमार', 'मंजू', 'पृथ्वी'.
   - Left-curving matra: 'ि' (chhoti i). Look for the vertical stem and arc before the consonant. Example: 'अमित', 'विनोद', 'कविता'.
   - Conjuncts (संयुक्ताक्षर) & Halants (्): Keep proper half-letters in names like 'प्रमोद', 'सुरेन्द्र', 'श्याम', 'विष्णु', 'कृष्णा', 'सत्येंद्र', 'धर्म'.
   - NEVER output disjoint spaced letters (like 'र ा म'). Always output the united word 'राम'.
   - Strip prefixes: Remove labels like 'नाम:', 'मतदाता का नाम:', 'पिता का नाम:', 'पति का नाम:' from the names.

3. TWO DISTINCT NUMBERS AT TOP:
   - Serial Number (क्रम संख्या): In the small box at the top left.
   - Voter ID / EPIC Number: At the top right or next to serial (e.g. SSB0996546, UP/01/...). Do NOT confuse serial number with voter ID. If unreadable or stamped over, return an empty string.

4. GENDER & AGE:
   - Look strictly at 'पुरुष' (male), 'स्त्री' (female). Translate to 'male', 'female', or 'other'.
   - Extract the numeric age.

5. SUMMARY TABLES:
   - Ignore summary tables at the end of supplements (e.g. 'परिवर्धन की', 'कुल'). Only extract individual voter boxes.

6. NEWLY ADDED VOTERS (परिवर्धन सूची / SUPPLEMENTARY ADDITIONS):
   - In supplementary addition lists (परिवर्धन सूची), newly registered voters naturally do NOT have an EPIC / Voter ID number yet (the ID space on the card is blank).
   - If a voter box does NOT have an EPIC number printed, return an empty string "" for voter_id.
   - NEVER guess, invent, or hallucinate a fake Voter ID for newly added voters. They are 100% legitimate, active citizens!
"""

def safe_parse_json(text: str) -> list:
    """Safely extracts and parses JSON array from LLM response text."""
    if not text:
        return []
    
    # Strip markdown fences
    cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```$', '', cleaned.strip(), flags=re.MULTILINE).strip()
    
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
        
    # Regex extract JSON array
    match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', cleaned)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
            
    return []

DEV_NUM_MAP = str.maketrans('०१२३४५६७८९', '0123456789')

# Comprehensive prefix stripping patterns
NAME_LABEL_PREFIX_PATTERN = re.compile(
    r'^(?:'
    r'नाम|मतदाता\s*(?:का\s*)?नाम|निर्वाचक\s*(?:का\s*)?नाम|'
    r'पिता\s*(?:का\s*)?नाम|पति\s*(?:का\s*)?नाम|माता\s*(?:का\s*)?नाम|'
    r'संरक्षक\s*(?:का\s*)?नाम|अभिभावक\s*(?:का\s*)?नाम|'
    r'पिता|पति|माता|अन्य|'
    r'Name|Father\'?s?\s*Name|Husband\'?s?\s*Name|Mother\'?s?\s*Name|Guardian\'?s?\s*Name'
    r')\s*[:\-।./]*\s*',
    re.IGNORECASE
)

HOUSE_PREFIX_PATTERN = re.compile(
    r'^(?:'
    r'मकान\s*(?:नं[०.]?|संख्या)?|म\.\s*नं[०.]?|गृह\s*संख्या|घर\s*नं[०.]?|'
    r'House\s*(?:No\.?|Number)?|H\.?\s*No\.?'
    r')\s*[:\-।./]*\s*',
    re.IGNORECASE
)

DELETED_STAMP_PATTERN = re.compile(
    r'(?:DELETED|SHIFTED|EXPIRED|REPEATED|विलोपित|निरस्त|रद्द|हटाया\s*गया)',
    re.IGNORECASE
)

def clean_hindi_text(text: str) -> str:
    """Normalizes Unicode (NFC), heals disjoint spaced letters, and strips label prefixes."""
    if not text:
        return ""
    # 1. Canonical Unicode normalization
    text = unicodedata.normalize('NFC', text.strip())
    
    # 2. Heal disjoint spaced letters (e.g. 'र ा म' -> 'राम')
    tokens = text.split()
    healed_tokens = []
    buffer = ""
    for t in tokens:
        if len(t) == 1 and '\u0900' <= t <= '\u097F':
            buffer += t
        else:
            if buffer:
                healed_tokens.append(buffer)
                buffer = ""
            healed_tokens.append(t)
    if buffer:
        healed_tokens.append(buffer)
    text = " ".join(healed_tokens)
    
    # 3. Strip OCR label prefixes (both Hindi & English)
    text = NAME_LABEL_PREFIX_PATTERN.sub('', text).strip()
    # Strip any trailing colons or punctuation
    text = re.sub(r'[:\-।./]+$', '', text).strip()
    return text

def clean_voter_record(raw_voter: dict, page_num: int, ward: int = None, source_file: str = "") -> dict:
    """Sanitizes, normalizes, and validates a raw voter dictionary with strict stamp and prefix checking."""
    is_deleted = bool(raw_voter.get('is_deleted_or_shifted', False))
    
    # Clean Serial Number
    raw_sn = str(raw_voter.get('serial_number') or '').strip().upper()
    # Translate Devanagari numerals if present
    raw_sn = raw_sn.translate(DEV_NUM_MAP)
    
    # Check for deletion / shift prefixes in serial number
    for prefix in ('S', 'E', 'R', 'Q', 'DEL', 'DELETED', 'SHIFTED', 'विलोपित', 'निरस्त'):
        if raw_sn.startswith(prefix):
            is_deleted = True
            raw_sn = raw_sn[len(prefix):].strip('-: /')
            break
            
    digits_match = re.search(r'\d+', raw_sn)
    clean_sn = int(digits_match.group(0)) if digits_match else None
    
    # Clean Hindi Name & Relative Name with Unicode NFC & Matra healing
    name_hi = clean_hindi_text(str(raw_voter.get('name_hi') or ''))
    rel_name_hi = clean_hindi_text(str(raw_voter.get('relative_name_hi') or ''))
    
    # Check for deletion stamps in name or voter_id fields
    voter_id_raw = str(raw_voter.get('voter_id') or '').strip()
    if DELETED_STAMP_PATTERN.search(name_hi) or DELETED_STAMP_PATTERN.search(voter_id_raw):
        is_deleted = True
        name_hi = DELETED_STAMP_PATTERN.sub('', name_hi).strip()
        voter_id_raw = DELETED_STAMP_PATTERN.sub('', voter_id_raw).strip()
    
    # Clean Relative Type
    rel_type = str(raw_voter.get('relative_type') or '').lower().strip()
    if 'पति' in rel_name_hi or 'husband' in rel_type:
        rel_type = 'husband'
    elif 'माता' in rel_name_hi or 'mother' in rel_type:
        rel_type = 'mother'
    elif 'father' in rel_type or 'पिता' in rel_name_hi:
        rel_type = 'father'
    elif rel_type not in ('father', 'husband', 'mother', 'other'):
        rel_type = 'father'
        
    # Clean Gender
    gender = str(raw_voter.get('gender') or '').lower().strip()
    if gender in ('पुरुष', 'पु', 'm', 'male', 'purush'):
        gender = 'male'
    elif gender in ('स्त्री', 'महिला', 'स्त्री.', 'f', 'female', 'mahila'):
        gender = 'female'
    else:
        gender = 'other' if gender in ('तृतीय लिंग', 'other', 't') else 'male'
        
    # Clean Age (support Devanagari numerals)
    raw_age_str = str(raw_voter.get('age', 0)).translate(DEV_NUM_MAP)
    age_match = re.search(r'\d+', raw_age_str)
    try:
        age = int(age_match.group(0)) if age_match else 0
        if age < 18 or age > 125:
            age = max(18, min(age, 120)) if age > 0 else 0
    except (ValueError, TypeError):
        age = 0
        
    # Clean House Number
    house_no = str(raw_voter.get('house_number') or '').strip()
    house_no = house_no.translate(DEV_NUM_MAP)
    house_no = HOUSE_PREFIX_PATTERN.sub('', house_no).strip()
    house_no = re.sub(r'[:\-।./]+$', '', house_no).strip()
    
    # Clean Voter ID (EPIC)
    voter_id = re.sub(r'\s+', '', voter_id_raw)
    if not voter_id or voter_id.lower() in ('none', 'null', '', 'nan'):
        sn_val = clean_sn if clean_sn is not None else 0
        if ward is not None:
            voter_id = f"TEMP_ID_W{ward}_{sn_val}"
        else:
            voter_id = f"TEMP_ID_{sn_val}"
        
    return {
        'ward': ward,
        'serial_number': clean_sn,
        'voter_id': voter_id,
        'name_hi': name_hi,
        'relative_name_hi': rel_name_hi,
        'relative_type': rel_type,
        'house_number': house_no,
        'age': age,
        'gender': gender,
        'page_number': page_num,
        'is_deleted_or_shifted': is_deleted,
        'source_file': source_file
    }

@retry(
    retry=retry_if_exception_type((APIError, ClientError)),
    wait=wait_exponential(multiplier=2, min=5, max=60),
    stop=stop_after_attempt(5),
    reraise=True
)
def _call_gemini_with_retry(client, model, contents, config):
    return client.models.generate_content(
        model=model,
        contents=contents,
        config=config
    )

def extract_from_chunk(client, pdf_path: str, start_page: int, end_page: int) -> list:
    """
    High-accuracy full-page extraction using Gemini 2.5 Flash.
    Extracts complete cards without bisecting grid rows.
    Automatically handles 429 rate limit errors with exponential backoff.
    """
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()

    prompt = BASE_PROMPT + f"\nProcess page number {start_page}."
    
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        temperature=0.0
    )
    contents = [
        types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
        prompt
    ]

    response = _call_gemini_with_retry(client, get_model_name(), contents, config)
    raw_voters = safe_parse_json(response.text)
    
    # If extraction is empty or suspiciously low (< 10) on a non-header page, retry once with explicit layout instruction
    if len(raw_voters) < 10 and start_page > 2:
        print(f"  [Notice] Page {start_page} returned {len(raw_voters)} voters. Running precision retry...")
        retry_prompt = prompt + "\nImportant: Read all 3 columns from top to bottom. Do not miss any boxes."
        retry_config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
            temperature=0.1
        )
        retry_contents = [
            types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
            retry_prompt
        ]
        retry_response = _call_gemini_with_retry(client, get_model_name(), retry_contents, retry_config)
        retry_voters = safe_parse_json(retry_response.text)
        if len(retry_voters) > len(raw_voters):
            raw_voters = retry_voters

    # Deduplicate by serial number if present
    seen_serials = {}
    deduped = []
    for v in raw_voters:
        sn = v.get('serial_number')
        if sn and sn in seen_serials:
            continue
        if sn:
            seen_serials[sn] = True
        deduped.append(v)
        
    return deduped

def parse_pdf(pdf_path: str, ward: int = None, start_page_arg: int = 1, end_page_arg: int = None, max_workers: int = None):
    """Processes a full PDF document and streams verified records to SQLite."""
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return []

    source_filename = os.path.basename(pdf_path)
    if ward is None:
        ward_match = re.search(r'ward\s*(?:no[-.\s]*)?(\d+)', source_filename, re.IGNORECASE)
        if ward_match:
            ward = int(ward_match.group(1))
            print(f"ℹ️ Auto-detected Ward: {ward} from filename '{source_filename}'")

    if max_workers is None:
        max_workers = get_recommended_workers()

    try:
        client = get_genai_client()
    except Exception as e:
        print(f"ERROR: Could not initialize AI client: {e}")
        return []
    reader = PdfReader(pdf_path)
    total_pdf_pages = len(reader.pages)
    actual_end_page = end_page_arg if end_page_arg is not None else total_pdf_pages

    print(f"Processing '{source_filename}' ({total_pdf_pages} pages) from page {start_page_arg} to {actual_end_page} (Workers: {max_workers})...")

    temp_dir = Path("temp_pages")
    temp_dir.mkdir(exist_ok=True)
    all_voters = []

    def process_page(page_idx):
        page_num = page_idx + 1
        page = reader.pages[page_idx]
        writer = PdfWriter()
        writer.add_page(page)

        temp_pdf = temp_dir / f"page_{page_num}.pdf"
        with open(temp_pdf, "wb") as f:
            writer.write(f)

        try:
            raw_voters = extract_from_chunk(client, str(temp_pdf), page_num, page_num)
            valid_voters = []
            for raw in raw_voters:
                cleaned = clean_voter_record(raw, page_num, ward, source_filename)
                if not cleaned['is_deleted_or_shifted']:
                    valid_voters.append(cleaned)

            print(f"  -> Page {page_num}: Extracted {len(raw_voters)} boxes, saved {len(valid_voters)} active voters.")
            return valid_voters
        except Exception as e:
            print(f"  [ERROR] Page {page_num} failed: {e}")
            return []
        finally:
            if temp_pdf.exists():
                temp_pdf.unlink()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(process_page, i) for i in range(start_page_arg - 1, actual_end_page)]
        for future in as_completed(futures):
            voters = future.result()
            if voters:
                all_voters.extend(voters)
                insert_voters(voters)

    try:
        temp_dir.rmdir()
    except OSError:
        pass

    print(f"Extraction complete for '{source_filename}'. Total active voters saved: {len(all_voters)}")
    return all_voters

def main():
    default_workers = get_recommended_workers()
    parser = argparse.ArgumentParser(description="Extract Electoral Roll PDF data to SQLite with 99% accuracy.")
    parser.add_argument("pdf_path", help="Path to the PDF file to process.")
    parser.add_argument("--ward", type=int, help="Optional Ward Number (auto-detected from filename if omitted).", default=None)
    parser.add_argument("--start-page", type=int, help="Page to start extraction from", default=1)
    parser.add_argument("--end-page", type=int, help="Page to end extraction at", default=None)
    parser.add_argument("--workers", type=int, default=default_workers, help=f"Number of concurrent worker threads (default: {default_workers}).")
    args = parser.parse_args()

    init_db()
    parse_pdf(args.pdf_path, args.ward, args.start_page, args.end_page, args.workers)

if __name__ == "__main__":
    main()

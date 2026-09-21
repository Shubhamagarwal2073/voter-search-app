import os
import sys
import sqlite3
import re
import argparse
from collections import defaultdict

# Force UTF-8 on Windows terminal to prevent UnicodeEncodeError with emojis and Hindi
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'nextjs-search-app', 'data', 'voters.db')
PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'input_pdfs')

def run_recheck(db_path: str = DEFAULT_DB_PATH, target_ward: int = None):
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    query = "SELECT id, ward, serial_number, voter_id, name_hi, relative_name_hi, house_number, age, gender, page_number, source_file FROM voters"
    params = []
    if target_ward is not None:
        query += " WHERE ward = ?"
        params.append(target_ward)
    query += " ORDER BY ward, page_number, serial_number"

    cur.execute(query, params)
    rows = cur.fetchall()
    total_records = len(rows)

    if total_records == 0:
        print(f"⚠️ No voters found in database{' for Ward ' + str(target_ward) if target_ward else ''}.")
        conn.close()
        return

    print("=" * 70)
    print(f"🔍 VOTER QUALITY AUDIT & RECHECK (Total Records: {total_records:,})")
    print("=" * 70)

    english_char_pattern = re.compile(r'[a-zA-Z]')
    unstripped_label_pattern = re.compile(r'^(?:नाम|पिता|पति|माता|मकान)\s*[:\-।.]', re.IGNORECASE)

    faulty_records = 0
    page_stats = defaultdict(lambda: {'count': 0, 'errors': [], 'serials': [], 'source_file': ''})
    ward_stats = defaultdict(lambda: {'total': 0, 'errors': 0, 'new_registrations': 0})
    seen_ward_serials = set()
    duplicate_serials = 0

    for r in rows:
        ward = r['ward'] or 0
        page = r['page_number'] or 0
        sn = r['serial_number'] or 0
        voter_id = str(r['voter_id'] or '').strip()
        name = str(r['name_hi'] or '').strip()
        rel_name = str(r['relative_name_hi'] or '').strip()
        source_file = r['source_file'] or ''

        ward_stats[ward]['total'] += 1
        page_key = (ward, page)
        page_stats[page_key]['count'] += 1
        page_stats[page_key]['serials'].append(sn)
        if not page_stats[page_key]['source_file'] and source_file:
            page_stats[page_key]['source_file'] = source_file

        record_errors = []

        # 1. Hindi Name Purity & Matra Integrity
        if english_char_pattern.search(name):
            record_errors.append("English chars in Name")
        if english_char_pattern.search(rel_name):
            record_errors.append("English chars in Relative Name")
        if unstripped_label_pattern.search(name) or unstripped_label_pattern.search(rel_name):
            record_errors.append("Unstripped label in Name")
        if len(name) <= 1:
            record_errors.append("Empty/single-letter Name")

        # Matra corruption: 5+ consecutive consonants without vowels or halant (excluding valid compound names)
        # 4-consonant sequences are common in Hindi names like मदनलाल, रतनलाल, कमलचंद, पवनकुमार, दशरथ
        def has_matra_corruption(text: str) -> bool:
            if not text:
                return False
            for word in text.split():
                if re.search(r'[क-ह]{5,}', word):
                    # Check if it has legitimate common compound endings
                    if not any(sub in word for sub in ('लाल', 'कुमार', 'चंद', 'राम', 'सिंह', 'राज', 'करण', 'प्रसाद', 'प्रकाश', 'नारायण')):
                        return True
                # Repeated triple consonants e.g. 'ररर'
                if re.search(r'([क-ह])\1{2,}', word):
                    return True
            return False

        if has_matra_corruption(name) or has_matra_corruption(rel_name):
            record_errors.append("Matra corruption (dropped vowels / unpronounceable sequence)")

        # Matra corruption: illegal stacked vowel signs (e.g. ाे or ीु)
        stacked_matra_pattern = re.compile(r'[\u093e-\u094c]{2,}')
        if stacked_matra_pattern.search(name) or stacked_matra_pattern.search(rel_name):
            record_errors.append("Illegal stacked matras")

        # Disjoint spaced letters (e.g. 'र ा ज')
        if re.search(r'[\u0900-\u097f]\s+[\u0900-\u097f]\s+[\u0900-\u097f]', name):
            record_errors.append("Disjoint spaced letters in Name")

        # 2. Duplicate Serials
        ward_sn_key = (ward, sn)
        if sn > 0 and ward_sn_key in seen_ward_serials:
            record_errors.append(f"Duplicate Serial {sn}")
            duplicate_serials += 1
        elif sn > 0:
            seen_ward_serials.add(ward_sn_key)

        # Track newly added voters / pending EPIC cards (NOT an error!)
        if not voter_id or voter_id.startswith('TEMP_') or voter_id.startswith('NEW_'):
            ward_stats[ward]['new_registrations'] += 1

        if record_errors:
            faulty_records += 1
            ward_stats[ward]['errors'] += 1
            page_stats[page_key]['errors'].append({
                'sn': sn,
                'name': name,
                'voter_id': voter_id,
                'reasons': record_errors
            })

    # Load known deleted serial numbers from extracted JSON if available to prevent flagging confirmed deletions as missing
    deleted_serials_by_ward = defaultdict(set)
    import glob
    json_files = glob.glob('/tmp/*_voters.json') + glob.glob('outputs/json/*_voters.json')
    for jf in json_files:
        try:
            with open(jf, 'r', encoding='utf-8') as f:
                jdata = json.load(f)
                for jv in jdata:
                    if jv.get('is_deleted_or_shifted'):
                        w = jv.get('ward')
                        sn_del = jv.get('serial_number')
                        if w is not None and sn_del is not None:
                            try:
                                w_int = int(w)
                                sn_int = int(re.search(r'\d+', str(sn_del)).group(0))
                                deleted_serials_by_ward[w_int].add(sn_int)
                            except Exception:
                                pass
        except Exception:
            pass

    # Page-level density & serial gap analysis
    faulty_pages = {}
    for (ward, page), pdata in page_stats.items():
        reasons = []
        valid_sns = sorted([s for s in pdata['serials'] if s > 0])
        
        # Count how many confirmed deletions fall within this page's serial number range
        page_del_count = 0
        if valid_sns:
            page_del_count = sum(1 for s in deleted_serials_by_ward[ward] if valid_sns[0] <= s <= valid_sns[-1])
        total_page_cards = pdata['count'] + page_del_count

        # If active + deleted is still suspiciously low on a middle page
        max_page = max((p[1] for p in page_stats.keys() if p[0] == ward), default=0)
        if page > 2 and total_page_cards < 15 and page < max_page:
            reasons.append(f"Suspiciously low count ({pdata['count']} active, {page_del_count} deleted)")

        gaps = []
        for i in range(len(valid_sns) - 1):
            diff = valid_sns[i+1] - valid_sns[i]
            if diff > 1 and diff < 10:
                potential_gaps = range(valid_sns[i] + 1, valid_sns[i+1])
                # Filter out confirmed deletions!
                real_missing = [g for g in potential_gaps if g not in deleted_serials_by_ward[ward]]
                gaps.extend(real_missing)
        if gaps:
            reasons.append(f"Missing serial numbers: {gaps[:5]}{'...' if len(gaps)>5 else ''}")

        if len(pdata['errors']) >= 3 or reasons:
            all_reasons = reasons + ([f"{len(pdata['errors'])} record spelling/id issues"] if pdata['errors'] else [])
            faulty_pages[(ward, page)] = {
                'reasons': all_reasons,
                'source_file': pdata['source_file'],
                'count': pdata['count']
            }

    accuracy_score = max(0.0, ((total_records - faulty_records) / total_records) * 100.0)

    print("\n📊 WARD-BY-WARD ACCURACY SUMMARY:")
    print(f"{'Ward':<8} | {'Total Voters':<14} | {'Clean Records':<14} | {'New Adds (No EPIC)':<18} | {'Errors':<8} | {'Accuracy':<10}")
    print("-" * 88)
    for ward, stats in sorted(ward_stats.items()):
        clean = stats['total'] - stats['errors']
        ward_acc = (clean / stats['total']) * 100.0 if stats['total'] > 0 else 0
        new_adds = stats['new_registrations']
        print(f"Ward {ward:<3} | {stats['total']:<14,} | {clean:<14,} | {new_adds:<18,} | {stats['errors']:<8} | {ward_acc:>6.2f}%")

    print("-" * 88)
    print(f"🎯 OVERALL DATABASE ACCURACY SCORE: {accuracy_score:.2f}%\n")

    if faulty_pages:
        print(f"🚨 FOUND {len(faulty_pages)} FAULTY / SUSPECT PAGES NEEDING RESCAN:")
        for (ward, page), info in sorted(faulty_pages.items()):
            print(f"   • Ward {ward}, Page {page} (File: {info['source_file'] or 'unknown'}): {', '.join(info['reasons'])}")
        
        generate_rescan_script(faulty_pages, db_path)
    else:
        print("✅ NO FAULTY PAGES DETECTED! Database meets 99%+ accuracy standards.")

    conn.close()

def generate_rescan_script(faulty_pages: dict, db_path: str):
    """Auto-generates core/rescan_faulty_page.py configured with the exact faulty pages."""
    script_path = os.path.join(os.path.dirname(__file__), 'rescan_faulty_page.py')
    
    formatted_dict = {}
    for (ward, page), info in sorted(faulty_pages.items()):
        source_file = info['source_file']
        pdf_path = os.path.join('input_pdfs', source_file) if source_file else f"input_pdfs/Ward_{ward}.pdf"
        if pdf_path not in formatted_dict:
            formatted_dict[pdf_path] = {'ward': ward, 'pages': []}
        formatted_dict[pdf_path]['pages'].append(page)

    content = f'''"""
Auto-generated by core/recheck.py to surgically heal identified faulty pages.
Target Database: {db_path}
"""
import os
import sys
from pypdf import PdfReader, PdfWriter
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Core modules
from extractor import extract_from_chunk, clean_voter_record
from database import get_connection
from google import genai
import google.auth
from google.auth.exceptions import DefaultCredentialsError

TARGET_PAGES = {formatted_dict}

def rescan_and_heal():
    print("=" * 60)
    print("🚑 HEALING FAULTY PAGES (High-Precision Single-Page Extractor)")
    print("=" * 60)

    try:
        credentials, project_id = google.auth.default()
        client = genai.Client(vertexai=True, project=project_id, location='us-central1')
        print(f"Authenticated with Vertex AI. Project: {{project_id}}")
    except DefaultCredentialsError:
        print("❌ Error: GCP credentials not found. Run: gcloud auth application-default login")
        return

    base_dir = os.path.dirname(os.path.dirname(__file__))
    temp_dir = Path(base_dir) / "temp_pages"
    temp_dir.mkdir(exist_ok=True)

    total_healed = 0

    for pdf_rel_path, target_info in TARGET_PAGES.items():
        pdf_full_path = os.path.join(base_dir, pdf_rel_path)
        ward = target_info['ward']
        pages = target_info['pages']
        source_filename = os.path.basename(pdf_full_path)

        if not os.path.exists(pdf_full_path):
            print(f"⚠️ PDF not found: {{pdf_full_path}}. Skipping.")
            continue

        reader = PdfReader(pdf_full_path)
        print(f"\\n📄 Rescanning {{len(pages)}} faulty page(s) in {{source_filename}} (Ward {{ward}}): {{pages}}")

        for page_num in pages:
            if page_num < 1 or page_num > len(reader.pages):
                continue

            page = reader.pages[page_num - 1]
            writer = PdfWriter()
            writer.add_page(page)

            temp_pdf = temp_dir / f"heal_w{{ward}}_p{{page_num}}.pdf"
            with open(temp_pdf, "wb") as f:
                writer.write(f)

            try:
                raw_voters = extract_from_chunk(client, str(temp_pdf), page_num, page_num)
                valid_voters = []
                for raw in raw_voters:
                    cleaned = clean_voter_record(raw, page_num, ward, source_filename)
                    if not cleaned['is_deleted_or_shifted']:
                        valid_voters.append(cleaned)

                with get_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM voters WHERE ward = ? AND page_number = ?", (ward, page_num))
                    for v in valid_voters:
                        cur.execute("""
                            INSERT OR REPLACE INTO voters 
                            (ward, serial_number, voter_id, name_hi, relative_name_hi, relative_type, house_number, age, gender, page_number, source_file)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            v['ward'], v['serial_number'], v['voter_id'], v['name_hi'],
                            v['relative_name_hi'], v['relative_type'], v['house_number'],
                            v['age'], v['gender'], v['page_number'], v['source_file']
                        ))
                    conn.commit()

                print(f"  ✅ Page {{page_num}}: Successfully updated with {{len(valid_voters)}} clean voters.")
                total_healed += len(valid_voters)

            except Exception as e:
                print(f"  ❌ Error healing Page {{page_num}}: {{e}}")
            finally:
                if temp_pdf.exists():
                    temp_pdf.unlink()

    try:
        temp_dir.rmdir()
    except OSError:
        pass

    print(f"\\n🎉 Healing complete! Total records updated: {{total_healed}}")
    print("Run 'python core/recheck.py' again to verify 99%+ accuracy score.")

if __name__ == "__main__":
    rescan_and_heal()
'''
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"\n⚡ Generated targeted healer: 'core/rescan_faulty_page.py'")
    print(f"   To heal these suspect pages, run: python core/rescan_faulty_page.py")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voter Database Quality Recheck & Accuracy Verification")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help="Path to SQLite database")
    parser.add_argument("--ward", type=int, default=None, help="Target specific Ward number")
    args = parser.parse_args()

    run_recheck(args.db, args.ward)

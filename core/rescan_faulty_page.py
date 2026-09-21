"""
Surgically heals identified faulty pages in electoral roll PDFs.
Supports both CLI arguments (--pdf, --ward, --pages) and auto-generated TARGET_PAGES dictionary.
"""
import os
import sys
import re
import argparse
from pypdf import PdfReader, PdfWriter
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Core modules
import sys
sys.path.append(os.path.dirname(__file__))
from extractor import extract_from_chunk, clean_voter_record
from database import get_connection
from ai_config import get_genai_client

# Dictionary of target pages (populated automatically by core/recheck.py)
TARGET_PAGES = {}

def parse_pages_arg(pages_str: str) -> list:
    """Parses comma-separated or range page strings e.g. '3,5,7-9' -> [3, 5, 7, 8, 9]."""
    pages = []
    for part in pages_str.split(','):
        part = part.strip()
        if '-' in part:
            s, e = part.split('-', 1)
            pages.extend(range(int(s), int(e) + 1))
        elif part.isdigit():
            pages.append(int(part))
    return sorted(list(set(pages)))

def rescan_and_heal(targets: dict = None):
    print("=" * 60)
    print("🚑 HEALING FAULTY PAGES (High-Precision Single-Page Extractor)")
    print("=" * 60)

    if not targets:
        targets = TARGET_PAGES

    if not targets:
        print("ℹ️ No target pages specified to heal.")
        print("👉 Usage: python core/rescan_faulty_page.py --pdf <path> --pages <3,5,7-9> [--ward <num>]")
        print("👉 Or run: python core/recheck.py to auto-detect faulty pages across the database.")
        return

    try:
        client = get_genai_client()
    except Exception as e:
        print(f"❌ Error initializing AI client: {e}")
        return

    base_dir = os.path.dirname(os.path.dirname(__file__))
    temp_dir = Path(base_dir) / "temp_pages"
    temp_dir.mkdir(exist_ok=True)

    total_healed = 0

    for pdf_rel_path, target_info in targets.items():
        pdf_full_path = os.path.join(base_dir, pdf_rel_path) if not os.path.isabs(pdf_rel_path) else pdf_rel_path
        if not os.path.exists(pdf_full_path):
            # Check relative to cwd
            if os.path.exists(pdf_rel_path):
                pdf_full_path = os.path.abspath(pdf_rel_path)
            else:
                print(f"⚠️ PDF not found: {pdf_full_path}. Skipping.")
                continue

        source_filename = os.path.basename(pdf_full_path)
        ward = target_info.get('ward')
        if ward is None:
            m = re.search(r'ward\s*(?:no[-.\s]*)?(\d+)', source_filename, re.IGNORECASE)
            ward = int(m.group(1)) if m else None

        pages = target_info.get('pages', [])
        reader = PdfReader(pdf_full_path)
        print(f"\n📄 Rescanning {len(pages)} page(s) in '{source_filename}' (Ward {ward}): {pages}")

        for page_num in pages:
            if page_num < 1 or page_num > len(reader.pages):
                print(f"  ⚠️ Skipping out-of-range page {page_num} (PDF has {len(reader.pages)} pages)")
                continue

            page = reader.pages[page_num - 1]
            writer = PdfWriter()
            writer.add_page(page)

            temp_pdf = temp_dir / f"heal_w{ward}_p{page_num}.pdf"
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

                print(f"  ✅ Page {page_num}: Successfully updated with {len(valid_voters)} clean voters.")
                total_healed += len(valid_voters)

            except Exception as e:
                print(f"  ❌ Error healing Page {page_num}: {e}")
            finally:
                if temp_pdf.exists():
                    try:
                        temp_pdf.unlink()
                    except OSError:
                        pass

    try:
        temp_dir.rmdir()
    except OSError:
        pass

    print(f"\n🎉 Healing complete! Total records updated: {total_healed}")
    print("Run 'python core/recheck.py' again to verify accuracy score.")

def main():
    parser = argparse.ArgumentParser(description="Surgically heal faulty pages in an electoral roll PDF.")
    parser.add_argument("--pdf", type=str, default=None, help="Path to PDF file to heal.")
    parser.add_argument("--ward", type=int, default=None, help="Ward number (auto-detected from filename if omitted).")
    parser.add_argument("--pages", type=str, default=None, help="Comma-separated page numbers or ranges (e.g. '3,5,7-9').")
    args = parser.parse_args()

    targets = None
    if args.pdf and args.pages:
        targets = {
            args.pdf: {
                'ward': args.ward,
                'pages': parse_pages_arg(args.pages)
            }
        }

    rescan_and_heal(targets)

if __name__ == "__main__":
    main()

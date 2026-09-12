# Voter Scrap — Automation & Extraction Scripts Guide

This directory contains the operational and automation scripts for the electoral roll database.

---

## 1. Primary Workflows

### A. Full PDF Electoral Roll Extraction
To extract an electoral roll PDF directly into the SQLite database (`nextjs-search-app/data/voters.db`):
```bash
python core/extractor.py "input_pdfs/Ward No-005-Part No-001.pdf" --ward 5
```
* **Engine:** Powered by `gemini-2.5-flash` with Devanagari Hindi Matra fidelity instructions.
* **Destination:** Automatically saved to `nextjs-search-app/data/voters.db`.

### B. Quality Audit & Recheck
To check database accuracy and detect any corruption, Hindi spelling degradation, or missing serials:
```bash
python core/recheck.py --ward 5
```
* **Output:** Audit report with accuracy percentage score.
* **Auto-generated Healer:** If suspect pages are found, it generates `core/rescan_faulty_page.py`.

### C. Surgical Page Healing
To rescan only the flagged pages from the recheck audit:
```bash
python core/rescan_faulty_page.py
```

---

## 2. Helper & Update Scripts (`scripts/`)

| Script | Purpose | Output Location |
| :--- | :--- | :--- |
| `scripts/run_all_updates.ps1` | Batch runner updating the last N pages (additions/deletions) for Wards 3, 5, 11, 31 | `nextjs-search-app/data/voters.db` |
| `scripts/update_last_n_pages.py` | Surgical updater for addition/deletion pages at the end of a ward PDF | `nextjs-search-app/data/voters.db` |
| `scripts/extract_candidates.py` | Extracts candidate profiles and symbols from `Candidate_directory.pdf` | `outputs/json/candidates.json` |

---

## 3. Ward 5 Block & Gali Extraction (`scripts/extraction/`)

These scripts organize Ward 5 voters into specific blocks, galis, and batches, generating CSVs, JSONs, and a combined Excel workbook:

* `scripts/extraction/extract_block_a.py` $\rightarrow$ `outputs/excel_csv/Block_A_Data_v3.csv` & `outputs/json/Block_A_Data_v3.json`
* `scripts/extraction/extract_block_b.py` $\rightarrow$ `outputs/excel_csv/Block_B_Data.csv` & `outputs/json/Block_B_Data.json`
* `scripts/extraction/extract_darzi_wali_gali.py` $\rightarrow$ `outputs/excel_csv/Darzi_Wali_Gali_Data.csv`
* `scripts/extraction/extract_narayan_ji.py` $\rightarrow$ `outputs/excel_csv/Narayan_Ji_Ki_Wadi_Data.csv`
* `scripts/extraction/extract_near_flat.py` $\rightarrow$ `outputs/excel_csv/Near_Flat_Data.csv`
* `scripts/extraction/extract_near_ramdhan.py` $\rightarrow$ `outputs/excel_csv/Near_Ramdhan_Data.csv`
* `scripts/extraction/extract_other.py` $\rightarrow$ `outputs/excel_csv/Other_Data.csv`
* `scripts/extraction/extract_sundar_complex.py` $\rightarrow$ `outputs/excel_csv/Sundar_Complex_Data.csv`
* `scripts/extraction/combine_to_excel.py` $\rightarrow$ `outputs/excel_csv/Ward_5_All_Blocks_Combined.xlsx`

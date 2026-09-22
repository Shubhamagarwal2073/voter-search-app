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
| `scripts/run_all_updates.ps1` | Batch runner updating the last N pages (additions/deletions) | `nextjs-search-app/data/voters.db` |
| `scripts/update_last_n_pages.py` | Surgical updater for addition/deletion pages at the end of a ward PDF | `nextjs-search-app/data/voters.db` |


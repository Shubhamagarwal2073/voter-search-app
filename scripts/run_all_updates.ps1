# Batch update helper for updating the last N pages of electoral roll PDFs.
# Ward numbers are now automatically detected from the PDF filenames!
# Example usage:
#   python scripts/update_last_n_pages.py "input_pdfs\Ward No-003-Part No-001.pdf" --last-n-pages 5
#   python scripts/update_last_n_pages.py "input_pdfs\Ward No-005-Part No-001.pdf" --last-n-pages 6

param (
    [string]$PdfPath,
    [int]$LastNPages = 5
)

if ($PdfPath) {
    python scripts/update_last_n_pages.py "$PdfPath" --last-n-pages $LastNPages
} else {
    Write-Host "Usage: .\run_all_updates.ps1 -PdfPath 'input_pdfs\Ward No-005-Part No-001.pdf' -LastNPages 5"
}

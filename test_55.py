import os
import json
from pypdf import PdfReader, PdfWriter
from google import genai
import google.auth

credentials, project_id = google.auth.default()
client = genai.Client(vertexai=True, project=project_id, location='us-central1')

pdf_path = r'C:\Users\Shubh\OneDrive\Desktop\IMPOSTER\world.s_services\Document_OCR\voter_list.pdf\DOC-20260425-WA0037..pdf'
reader = PdfReader(pdf_path)

page = reader.pages[54] # Page 55 (0-indexed)
writer = PdfWriter()
writer.add_page(page)

with open('temp_page55.pdf', 'wb') as f:
    writer.write(f)

from extractor import extract_from_chunk
try:
    voters = extract_from_chunk(client, 'temp_page55.pdf', 55, 55)
    for v in voters:
        print(f"Raw Serial: '{v.get('serial_number')}' | Name: {v.get('name_hi')}")
finally:
    if os.path.exists('temp_page55.pdf'):
        os.remove('temp_page55.pdf')

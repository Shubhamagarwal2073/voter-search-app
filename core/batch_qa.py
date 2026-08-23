import os
import re
from recorrection import check_accuracy_and_heal

def run_batch():
    folder = r"C:\Users\happy\OneDrive\Documents\temp_voter"
    print(f"Starting batch QA reverification for folder: {folder}\n")
    
    files = sorted([f for f in os.listdir(folder) if f.endswith('.pdf')])
    
    if not files:
        print("No PDF files found in the folder.")
        return
        
    for file in files:
        match = re.search(r'Ward No[-.\s]*0*(\d+)', file, re.IGNORECASE)
        if match:
            ward = int(match.group(1))
            pdf_path = os.path.join(folder, file)
            print(f"\n{'='*50}")
            print(f"=== BATCH PROCESSING WARD {ward} ===")
            print(f"{'='*50}\n")
            
            try:
                check_accuracy_and_heal(pdf_path, ward)
            except Exception as e:
                print(f"Fatal error processing {file}: {e}")
        else:
            print(f"Could not extract ward number from {file}. Skipping.")

if __name__ == "__main__":
    run_batch()

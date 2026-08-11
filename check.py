import sqlite3

def analyze_db():
    conn = sqlite3.connect('nextjs-search-app/data/voters.db')
    
    print("--- DATABASE DIAGNOSTIC ---")
    
    # 1. Total records
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM voters")
    total = cur.fetchone()[0]
    print(f"Total Records in DB: {total}")
    
    # 2. Check for duplicate Serial Numbers (Supplementals)
    cur.execute("""
        SELECT serial_number, COUNT(*) as count 
        FROM voters 
        GROUP BY serial_number 
        HAVING count > 1 
        ORDER BY count DESC
    """)
    dups = cur.fetchall()
    print(f"Number of Serial Numbers that appear more than once: {len(dups)}")
    
    # 3. Check for Serial Numbers out of bounds (> 1374)
    cur.execute("SELECT COUNT(*) FROM voters WHERE serial_number > 1374")
    out_of_bounds = cur.fetchone()[0]
    print(f"Number of voters with Serial No > 1374: {out_of_bounds}")
    
    # 4. Check for missing Serial Numbers between 1 and 1374
    cur.execute("SELECT serial_number FROM voters WHERE serial_number <= 1374 ORDER BY serial_number")
    existing_serials = set([r[0] for r in cur.fetchall()])
    expected_serials = set(range(1, 1375))
    missing = expected_serials - existing_serials
    print(f"Number of 'missing' or 'deleted' Serial Numbers (1-1374): {len(missing)}")

if __name__ == '__main__':
    analyze_db()

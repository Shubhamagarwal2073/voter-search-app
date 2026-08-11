import sqlite3
conn = sqlite3.connect('nextjs-search-app/data/voters.db')
cur = conn.cursor()
cur.execute("DELETE FROM voters WHERE serial_number = 1376 AND voter_id = ''")
print(f"Deleted {cur.rowcount} ghost duplicates.")
conn.commit()

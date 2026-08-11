import sqlite3
conn = sqlite3.connect('nextjs-search-app/data/voters.db')
cur = conn.cursor()
cur.execute("SELECT serial_number, voter_id FROM voters WHERE page_number = 55 OR voter_id IS NULL OR voter_id = ''")
print("Page 55 and empty voter_id records:", cur.fetchall())

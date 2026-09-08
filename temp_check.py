import sqlite3

conn = sqlite3.connect('c:/Users/happy/downloads/Voter_scrap-main/Voter_scrap/nextjs-search-app/data/voters.db')
print("Total voters:", conn.execute("SELECT count(*) FROM voters;").fetchone()[0])

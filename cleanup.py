import sqlite3

def force_cleanup():
    conn = sqlite3.connect('nextjs-search-app/data/voters.db')
    cursor = conn.cursor()
    
    # ALL 42 DELETED VOTERS
    to_delete = [
        1343, 1344, 1345, 1346, 1347, 1348,
        1313, 1314, 1315, 1316, 1317, 1318,
        815, 652, 621, 532, 512,
        655, 656, 657, 658, 659,
        588, 589, 590, 591, 592, 593, 594,
        318, 319, 320, 321, 322,
        311, 312, 313, 297, 261, 262, 160, 161
    ]
    
    placeholders = ','.join('?' * len(to_delete))
    query = f"DELETE FROM voters WHERE serial_number IN ({placeholders})"
    
    cursor.execute(query, to_delete)
    deleted_count = cursor.rowcount
    conn.commit()
    
    print(f"Force cleanup ran! Deleted {deleted_count} stragglers.")
    
    # Verify they are gone
    cursor.execute(f"SELECT serial_number FROM voters WHERE serial_number IN ({placeholders})", to_delete)
    remaining = cursor.fetchall()
    print(f"Remaining in DB: {len(remaining)}")

if __name__ == '__main__':
    force_cleanup()

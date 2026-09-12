import sqlite3
import os

# Store DB inside Next.js data folder so Vercel can access it
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'nextjs-search-app', 'data', 'voters.db')

def get_connection():
    """Returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema if it doesn't exist."""
    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS voters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ward INTEGER,
                    serial_number INTEGER,
                    voter_id TEXT UNIQUE,
                    name_hi TEXT,
                    relative_name_hi TEXT,
                    relative_type TEXT,
                    house_number TEXT,
                    age INTEGER,
                    gender TEXT,
                    page_number INTEGER,
                    source_file TEXT
                )
            ''')
            conn.commit()
            print("Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing database: {e}")

def insert_voters(voters_list: list):
    """Inserts a list of voter dictionaries into the database."""
    inserted_count = 0
    with get_connection() as conn:
        cursor = conn.cursor()
        for voter in voters_list:
            try:
                cursor.execute('''
                    INSERT INTO voters 
                    (ward, serial_number, voter_id, name_hi, relative_name_hi, relative_type, house_number, age, gender, page_number, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(voter_id) DO UPDATE SET
                        ward=excluded.ward,
                        serial_number=excluded.serial_number,
                        name_hi=excluded.name_hi,
                        relative_name_hi=excluded.relative_name_hi,
                        relative_type=excluded.relative_type,
                        house_number=excluded.house_number,
                        age=excluded.age,
                        gender=excluded.gender,
                        page_number=excluded.page_number,
                        source_file=excluded.source_file
                ''', (
                    voter.get('ward'),
                    voter.get('serial_number'),
                    voter.get('voter_id'),
                    voter.get('name_hi'),
                    voter.get('relative_name_hi'),
                    voter.get('relative_type'),
                    voter.get('house_number'),
                    voter.get('age'),
                    voter.get('gender'),
                    voter.get('page_number'),
                    voter.get('source_file')
                ))
                inserted_count += 1
            except sqlite3.IntegrityError as e:
                print(f"Error inserting {voter.get('voter_id')}: {e}")
                
        conn.commit()
    print(f"Successfully processed {inserted_count} voters.")
    return inserted_count

if __name__ == '__main__':
    init_db()

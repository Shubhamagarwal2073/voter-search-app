-- schema.sql
CREATE TABLE IF NOT EXISTS voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id TEXT UNIQUE NOT NULL,
    name_hi TEXT NOT NULL,
    relative_name_hi TEXT,
    relative_type TEXT, -- 'father' or 'husband'
    house_number TEXT,
    age INTEGER,
    gender TEXT, -- 'male', 'female', 'other'
    page_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voter_id ON voters(voter_id);
CREATE INDEX IF NOT EXISTS idx_name_hi ON voters(name_hi);
CREATE INDEX IF NOT EXISTS idx_house_number ON voters(house_number);

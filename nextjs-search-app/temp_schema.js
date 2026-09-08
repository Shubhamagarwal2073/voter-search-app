const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function fix() {
  const db = await open({filename: './data/auth.db', driver: sqlite3.Database});
  
  const schema = await db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
  console.log("SCHEMA:", schema);
  
  if (!schema.sql.includes('image TEXT')) {
    console.log("Adding image column...");
    await db.run("ALTER TABLE users ADD COLUMN image TEXT");
    console.log("Added image column.");
  } else {
    console.log("Image column already exists.");
  }
}

fix();

const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const dbPath = path.resolve(__dirname, '../../nextjs-search-app/data/voters.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

async function migrateVoters() {
  try {
    db.all(`SELECT * FROM voters`, async (err, rows) => {
      if (err) {
        console.error('Error fetching voters from SQLite:', err.message);
        return;
      }

      console.log(`Found ${rows.length} voters to migrate. Starting upload...`);
      const BATCH_SIZE = 1000;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE).map((row) => ({
          voter_id: row.voter_id || `temp-${Math.random().toString(36).substring(7)}`,
          ward: row.ward,
          serial_number: row.serial_number,
          name_hi: row.name_hi,
          relative_name_hi: row.relative_name_hi,
          house_number: row.house_number,
          gender: row.gender,
        }));

        await prisma.voter.createMany({
          data: batch,
          skipDuplicates: true,
        });

        inserted += batch.length;
        console.log(`Migrated ${inserted}/${rows.length} voters...`);
      }

      console.log('Migration completed successfully!');
      process.exit(0);
    });
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateVoters();

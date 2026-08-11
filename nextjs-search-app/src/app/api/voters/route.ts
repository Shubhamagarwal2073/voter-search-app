import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export const dynamic = 'force-dynamic';

// Store DB inside Next.js data folder so Vercel can deploy it
const dbPath = path.resolve(process.cwd(), 'data', 'voters.db');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'name'; // 'name', 'voter_id', 'house', 'serial'
  const ward = searchParams.get('ward') || ''; // optional ward filter

  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    let voters = [];
    
    // Build ward clause
    const wardClause = ward ? `AND ward = ?` : '';
    const wardParam = ward ? [parseInt(ward, 10)] : [];

    if (query) {
      if (type === 'voter_id') {
        voters = await db.all(`SELECT * FROM voters WHERE voter_id LIKE ? ${wardClause} LIMIT 50`, [`%${query}%`, ...wardParam]);
      } else if (type === 'house') {
        voters = await db.all(`SELECT * FROM voters WHERE house_number LIKE ? ${wardClause} LIMIT 50`, [`%${query}%`, ...wardParam]);
      } else if (type === 'serial') {
        voters = await db.all(`SELECT * FROM voters WHERE serial_number = ? ${wardClause} LIMIT 50`, [parseInt(query, 10), ...wardParam]);
      } else {
        // --- FUZZY SEARCH FOR NAMES ---
        // 1. Fetch the subset of voters (filtered by ward if applicable)
        const allVotersQuery = `SELECT * FROM voters ${wardClause ? 'WHERE ' + wardClause.replace('AND ', '') : ''}`;
        const allVotersForWard = await db.all(allVotersQuery, wardParam);
        
        // 2. Use Fuse.js to find the closest phonetic/fuzzy matches
        const Fuse = (await import('fuse.js')).default;
        const fuse = new Fuse(allVotersForWard, {
          keys: ['name_hi', 'relative_name_hi'],
          threshold: 0.4, // Allows for matra and spelling differences
          ignoreLocation: true,
        });

        // 3. Map results back and limit to 50
        const fuzzyResults = fuse.search(query);
        voters = fuzzyResults.map(result => result.item).slice(0, 50);
      }
    } else {
      // If no query, just return a few recent ones, respecting ward
      if (ward) {
        voters = await db.all(`SELECT * FROM voters WHERE ward = ? LIMIT 10`, [parseInt(ward, 10)]);
      } else {
        voters = await db.all(`SELECT * FROM voters LIMIT 10`);
      }
    }

    await db.close();
    return NextResponse.json({ success: true, data: voters });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

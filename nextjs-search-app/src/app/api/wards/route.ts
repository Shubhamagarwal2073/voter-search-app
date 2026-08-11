import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export const dynamic = 'force-dynamic';

// Store DB inside Next.js data folder so Vercel can deploy it
const dbPath = path.resolve(process.cwd(), 'data', 'voters.db');

export async function GET() {
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    const wards = await db.all('SELECT DISTINCT ward FROM voters WHERE ward IS NOT NULL ORDER BY ward ASC');
    const countRow = await db.get('SELECT COUNT(*) as total FROM voters');
    await db.close();

    const wardNumbers = wards.map(w => w.ward);
    return NextResponse.json({ success: true, data: wardNumbers, totalVoters: countRow.total });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

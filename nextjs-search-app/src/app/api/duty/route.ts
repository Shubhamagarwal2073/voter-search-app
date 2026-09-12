import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const filter = searchParams.get('filter') || 'gali';

  try {
    const dbPath = path.join(process.cwd(), 'data', 'duty_candidate.db');
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

    const data = await new Promise((resolve, reject) => {
      let sql = '';
      let params: string[] = [];

      if (!query.trim()) {
         sql = `SELECT * FROM duty_candidates LIMIT 100`;
      } else {
        if (filter === 'gali') {
          sql = `SELECT * FROM duty_candidates WHERE gali LIKE ?`;
        } else if (filter === 'block') {
          sql = `SELECT * FROM duty_candidates WHERE block LIKE ?`;
        } else {
          sql = `SELECT * FROM duty_candidates WHERE gali LIKE ? OR block LIKE ?`;
          params = [`%${query}%`, `%${query}%`];
        }

        if (params.length === 0) {
           params = [`%${query}%`];
        }
      }

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    db.close();

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Duty API Error:', error);
    return NextResponse.json({ success: false, error: 'Database query failed' }, { status: 500 });
  }
}

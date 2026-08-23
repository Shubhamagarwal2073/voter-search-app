import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export const dynamic = 'force-dynamic';

// Store DB inside Next.js data folder so Vercel can deploy it
const dbPath = path.resolve(process.cwd(), 'data', 'voters.db');

// Simple in-memory rate limiter (25 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function GET(request: Request) {
  // --- Rate Limiting Logic ---
  const ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const limit = 25; // Max requests per minute

  const rateLimitData = rateLimitMap.get(ip);
  if (rateLimitData) {
    if (now > rateLimitData.resetTime) {
      // Window expired, reset
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      rateLimitData.count++;
      if (rateLimitData.count > limit) {
        return NextResponse.json({ success: false, error: 'Too many requests. Please wait a minute before searching again.' }, { status: 429 });
      }
    }
  } else {
    // New IP
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
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
        // --- HYBRID SEARCH FOR NAMES ---
        // 1. First, try an EXACT substring match (fastest and most accurate)
        const exactQuery = `%${query}%`;
        const exactSql = `SELECT * FROM voters WHERE (name_hi LIKE ? OR relative_name_hi LIKE ?) ${wardClause} LIMIT 50`;
        const exactResults = await db.all(exactSql, [exactQuery, exactQuery, ...wardParam]);

        if (exactResults.length > 0) {
          // If we found exact matches (e.g. they typed the name perfectly), return them!
          voters = exactResults;
        } else {
          // 2. If ZERO exact matches found, they probably made a spelling/matra mistake. 
          // Fall back to a strict fuzzy search!
          const allVotersQuery = `SELECT * FROM voters ${wardClause ? 'WHERE ' + wardClause.replace('AND ', '') : ''}`;
          const allVotersForWard = await db.all(allVotersQuery, wardParam);
          
          const Fuse = (await import('fuse.js')).default;
          const fuse = new Fuse(allVotersForWard, {
            keys: ['name_hi', 'relative_name_hi'],
            threshold: 0.2, // Strict threshold to prevent random matches
            ignoreLocation: true,
          });

          const fuzzyResults = fuse.search(query);
          voters = fuzzyResults.map(result => result.item).slice(0, 50);
        }
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

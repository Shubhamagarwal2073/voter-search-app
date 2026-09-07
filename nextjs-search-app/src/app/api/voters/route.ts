import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

// Store DB inside Next.js data folder so Vercel can deploy it
const dbPath = path.resolve(process.cwd(), 'data', 'voters.db');

// Path to auth DB for rate limiting
const authDbPath = path.resolve(process.cwd(), 'data', 'auth.db');

// Simple in-memory rate limiter for Admins (25 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function GET(request: Request) {
  let ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim(); // Prevent IP spoofing by strictly taking the true original IP
  }

  const now = Date.now();
  const windowMs24h = 24 * 60 * 60 * 1000; // 24 hours for freemium

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'name'; // 'name', 'voter_id', 'house', 'serial'
  let ward = searchParams.get('ward') || ''; // optional ward filter

  try {
    const session: any = await getServerSession(authOptions);
    const role = session?.user?.role || 'public';

    // Security Rule: Public users (not logged in) can ONLY search by Voter ID
    if (role === 'public' && query.length > 0 && type !== 'voter_id') {
      return NextResponse.json({ success: false, error: 'Public users can only search by Voter ID. Please sign in with Google to search by Name.' }, { status: 403 });
    }

    // --- RATE LIMITING LOGIC ---
    // TIER 3: ADMINS & PAID USERS - Unlimited total, but 25 requests per minute to prevent scraping
    if (role === 'admin' || role === 'paid' || role === 'user' || (session?.user?.email && process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL)) {
      const rateLimitData = rateLimitMap.get(ip);
      const windowMs = 60 * 1000; // 1 minute
      if (rateLimitData) {
        if (now > rateLimitData.resetTime) {
          rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        } else {
          rateLimitData.count++;
          if (rateLimitData.count > 25) {
            return NextResponse.json({ success: false, error: 'Too many requests. Please wait a minute before searching again.', code: 'RATE_LIMIT_ADMIN' }, { status: 429 });
          }
        }
      } else {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      }
    } else {
      // TIER 1 & 2: PUBLIC and GUESTS - Persistent IP tracking in DB
      const userAgent = request.headers.get('user-agent') || 'unknown_ua';
      const clientIdentifier = `${ip}|${userAgent}`;

      const authDb = await open({ filename: authDbPath, driver: sqlite3.Database });
      try {
        await authDb.exec('PRAGMA journal_mode = WAL;');
        await authDb.exec('PRAGMA synchronous = NORMAL;');
        await authDb.run('CREATE TABLE IF NOT EXISTS public_limits (ip TEXT PRIMARY KEY, search_count INTEGER, last_reset INTEGER)');

        const ipRecord = await authDb.get('SELECT * FROM public_limits WHERE ip = ?', [clientIdentifier]);

        let currentCount = 0;
        if (ipRecord) {
          if (now > ipRecord.last_reset + windowMs24h) {
            // Reset after 24h
            await authDb.run('UPDATE public_limits SET search_count = 0, last_reset = ? WHERE ip = ?', [now, clientIdentifier]);
          } else {
            currentCount = ipRecord.search_count;
          }
        } else {
          await authDb.run('INSERT INTO public_limits (ip, search_count, last_reset) VALUES (?, 0, ?)', [clientIdentifier, now]);
        }

        console.log(`[RateLimit] Role: ${role}, Client: ${clientIdentifier}, CurrentCount: ${currentCount}`);

        const limit = role === 'guest' ? 4 : 2; // Public gets 2, Guests get 2 MORE (4 total per IP)

        // If there is an actual search query (not just initial load), increment and check limit
        if (query || ward) {
          if (currentCount >= limit) {
            const code = role === 'guest' ? 'QUOTA_EXCEEDED_GUEST' : 'QUOTA_EXCEEDED_PUBLIC';
            return NextResponse.json({ success: false, error: 'Daily search limit exceeded.', code }, { status: 429 });
          }
          try {
            await authDb.run('UPDATE public_limits SET search_count = search_count + 1 WHERE ip = ?', [clientIdentifier]);
          } catch (dbErr) {
            console.error("Failed to update rate limit (locked). Ignoring.", dbErr);
          }
        }
      } finally {
        await authDb.close();
      }
    }
    // --- END RATE LIMITING ---

    let allowedArr: number[] = [];
    
    // Only strictly enforce allowed_wards if they are a 'paid' user
    if (role === 'paid') {
      const allowed = session?.user?.allowed_wards;
      if (allowed === 'all') {
        // Allowed all wards, leave array empty
      } else if (allowed && allowed.trim() !== '') {
        allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
        // If a specific ward was requested, verify it's in the allowed list
        if (ward && !allowedArr.includes(parseInt(ward, 10))) {
          return NextResponse.json({ success: false, error: 'Forbidden ward access' }, { status: 403 });
        }
      } else {
        // If they are a paid user but have an empty allowed_wards field, lock them out!
        return NextResponse.json({ success: false, error: 'Your account has not been assigned to any wards. Please contact the administrator.' }, { status: 403 });
      }
    } else if (role === 'user' || role === 'guest') {
      // For free guests, if they have a specific ward restriction, apply it.
      // Otherwise, they are allowed to search all wards (bounded by their rate limit).
      const allowed = session?.user?.allowed_wards;
      if (allowed && allowed !== 'all' && allowed.trim() !== '') {
        allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
        if (ward && !allowedArr.includes(parseInt(ward, 10))) {
          return NextResponse.json({ success: false, error: 'Forbidden ward access' }, { status: 403 });
        }
      }
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    try {
      let voters = [];

      // Build ward clause
      let wardClause = '';
      let wardParam: any[] = [];

      if (ward) {
        wardClause = `AND ward = ?`;
        wardParam = [parseInt(ward, 10)];
      } else if (allowedArr.length > 0) {
        wardClause = `AND ward IN (${allowedArr.map(() => '?').join(',')})`;
        wardParam = allowedArr;
      }

      if (query) {
        const isPublic = role !== 'admin' && role !== 'paid';

        if (type === 'voter_id') {
          const upperQuery = query.toUpperCase();
          const sqlParam = isPublic ? upperQuery : `%${upperQuery}%`;
          voters = await db.all(`SELECT * FROM voters WHERE voter_id LIKE ? ${wardClause} LIMIT 50`, [sqlParam, ...wardParam]);
        } else if (type === 'house') {
          const sqlParam = isPublic ? query : `%${query}%`;
          voters = await db.all(`SELECT * FROM voters WHERE house_number LIKE ? ${wardClause} LIMIT 50`, [sqlParam, ...wardParam]);
        } else if (type === 'serial') {
          voters = await db.all(`SELECT * FROM voters WHERE serial_number = ? ${wardClause} LIMIT 50`, [parseInt(query, 10), ...wardParam]);
        } else if (type === 'name') {
          // --- EXACT FIRST, THEN FUZZY ---
          const exactQuery = `%${query}%`;
          const exactSql = `SELECT * FROM voters WHERE name_hi LIKE ? ${wardClause} LIMIT 50`;
          const exactResults = await db.all(exactSql, [exactQuery, ...wardParam]);

          if (exactResults.length > 0) {
            voters = exactResults;
          } else {
            const allVotersQuery = `SELECT * FROM voters ${wardClause ? 'WHERE ' + wardClause.replace('AND ', '') : ''}`;
            const allVotersForWard = await db.all(allVotersQuery, wardParam);

            const Fuse = (await import('fuse.js')).default;
            const fuse = new Fuse(allVotersForWard, {
              keys: ['name_hi'],
              threshold: 0.2, // Strict threshold
              ignoreLocation: true,
            });

            voters = fuse.search(query).map(result => result.item).slice(0, 50);
          }
        } else if (type === 'relative_name') {
          // --- EXACT FIRST, THEN FUZZY ---
          const exactQuery = `%${query}%`;
          const exactSql = `SELECT * FROM voters WHERE relative_name_hi LIKE ? ${wardClause} LIMIT 50`;
          const exactResults = await db.all(exactSql, [exactQuery, ...wardParam]);

          if (exactResults.length > 0) {
            voters = exactResults;
          } else {
            const allVotersQuery = `SELECT * FROM voters ${wardClause ? 'WHERE ' + wardClause.replace('AND ', '') : ''}`;
            const allVotersForWard = await db.all(allVotersQuery, wardParam);

            const Fuse = (await import('fuse.js')).default;
            const fuse = new Fuse(allVotersForWard, {
              keys: ['relative_name_hi'],
              threshold: 0.2, // Strict threshold
              ignoreLocation: true,
            });

            voters = fuse.search(query).map(result => result.item).slice(0, 50);
          }
        }
      } else {
        // If no query, just return a few recent ones, respecting ward
        if (ward) {
          voters = await db.all(`SELECT * FROM voters WHERE ward = ? LIMIT 10`, [parseInt(ward, 10)]);
        } else if (allowedArr.length > 0) {
          voters = await db.all(`SELECT * FROM voters WHERE ward IN (${allowedArr.map(() => '?').join(',')}) LIMIT 10`, allowedArr);
        } else {
          voters = await db.all(`SELECT * FROM voters LIMIT 10`);
        }
      }

      // Mask voter ID for public and unpaid users
      if (role !== 'admin' && role !== 'paid') {
        voters = voters.map((voter: any) => {
          if (voter.voter_id && voter.voter_id.length > 4) {
            const v = voter.voter_id;
            const maskedId = v.substring(0, 3) + '****' + v.substring(v.length - 3);
            return { ...voter, voter_id: maskedId };
          }
          return { ...voter, voter_id: '***' };
        });
      }

      return NextResponse.json({ success: true, data: voters });
    } finally {
      await db.close();
    }

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

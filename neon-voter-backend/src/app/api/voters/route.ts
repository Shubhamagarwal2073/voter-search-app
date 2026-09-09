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
  
  // Parse pagination params with safe fallbacks and caps
  let limit = Math.min(Math.max(1, Number(searchParams.get('limit')) || 50), 200);
  if (!Number.isFinite(limit)) limit = 50;
  
  let page = Number(searchParams.get('page')) || 1;
  if (!Number.isFinite(page) || page < 1) page = 1;

  try {
    const session: any = await getServerSession(authOptions);
    const role = session?.user?.role || 'public';

    // Security Rule: Public users (not logged in) can ONLY search by Voter ID
    if (role === 'public' && query.length > 0 && type !== 'voter_id') {
      return NextResponse.json({ success: false, error: 'Public users can only search by Voter ID. Please sign in with Google to search by Name.' }, { status: 403 });
    }

    // --- RATE LIMITING LOGIC ---
    // TIER 3: ADMINS & PAID USERS - Unlimited total, but 25 requests per minute to prevent scraping
    if (role === 'admin' || role === 'paid' || (session?.user?.email && process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL)) {
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
      // Temporary in-memory rate limit for public/guests
      const rateLimitData = rateLimitMap.get(ip);
      const limit = role === 'guest' ? 4 : 2;
      if (query || ward) {
         if (rateLimitData) {
           if (rateLimitData.count >= limit) {
             const code = role === 'guest' ? 'QUOTA_EXCEEDED_GUEST' : 'QUOTA_EXCEEDED_PUBLIC';
             return NextResponse.json({ success: false, error: 'Daily search limit exceeded.', code }, { status: 429 });
           }
           rateLimitData.count++;
         } else {
           rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs24h });
         }
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
      let totalItems = 0;
      let totalPages = 1;
      let currentPage = page;

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
      
      // Helper function to safely slice results and compute metadata
      const applyFuzzyPagination = (allResults: any[]) => {
        totalItems = allResults.length;
        totalPages = Math.max(1, Math.ceil(totalItems / limit));
        currentPage = Math.min(Math.max(1, page), totalPages);
        return allResults.slice((currentPage - 1) * limit, currentPage * limit);
      };

      // Helper function to execute SQL with COUNT(*) in parallel
      const executePaginatedSql = async (baseQuery: string, countQuery: string, params: any[]) => {
        const [countResult, dataResult] = await Promise.all([
          db.get(countQuery, params),
          db.all(`${baseQuery} LIMIT ? OFFSET ?`, [...params, limit, (Math.max(1, page) - 1) * limit])
        ]);
        
        totalItems = countResult.total || 0;
        totalPages = Math.max(1, Math.ceil(totalItems / limit));
        currentPage = Math.min(Math.max(1, page), totalPages);
        
        // Re-fetch if the requested page was out of bounds
        if (page > totalPages) {
            const safeOffset = (currentPage - 1) * limit;
            return await db.all(`${baseQuery} LIMIT ? OFFSET ?`, [...params, limit, safeOffset]);
        }
        return dataResult;
      };

      if (query) {
        const isPublic = role !== 'admin' && role !== 'paid';

        if (type === 'voter_id') {
          const upperQuery = query.toUpperCase();
          const sqlParam = isPublic ? upperQuery : `%${upperQuery}%`;
          const baseSql = `SELECT * FROM voters WHERE voter_id LIKE ? ${wardClause}`;
          const countSql = `SELECT COUNT(*) as total FROM voters WHERE voter_id LIKE ? ${wardClause}`;
          voters = await executePaginatedSql(baseSql, countSql, [sqlParam, ...wardParam]);
        } else if (type === 'house') {
          const sqlParam = isPublic ? query : `%${query}%`;
          const baseSql = `SELECT * FROM voters WHERE house_number LIKE ? ${wardClause}`;
          const countSql = `SELECT COUNT(*) as total FROM voters WHERE house_number LIKE ? ${wardClause}`;
          voters = await executePaginatedSql(baseSql, countSql, [sqlParam, ...wardParam]);
        } else if (type === 'serial') {
          const baseSql = `SELECT * FROM voters WHERE serial_number = ? ${wardClause}`;
          const countSql = `SELECT COUNT(*) as total FROM voters WHERE serial_number = ? ${wardClause}`;
          voters = await executePaginatedSql(baseSql, countSql, [parseInt(query, 10), ...wardParam]);
        } else if (type === 'name' || type === 'relative_name') {
          const searchField = type === 'name' ? 'name_hi' : 'relative_name_hi';
          const exactQuery = `%${query}%`;
          const countSql = `SELECT COUNT(*) as total FROM voters WHERE ${searchField} LIKE ? ${wardClause}`;
          const exactCountResult = await db.get(countSql, [exactQuery, ...wardParam]);
          
          if (exactCountResult.total > 0) {
            const baseSql = `SELECT * FROM voters WHERE ${searchField} LIKE ? ${wardClause}`;
            voters = await executePaginatedSql(baseSql, countSql, [exactQuery, ...wardParam]);
          } else {
            const allVotersQuery = `SELECT * FROM voters ${wardClause ? 'WHERE ' + wardClause.replace('AND ', '') : ''}`;
            const allVotersForWard = await db.all(allVotersQuery, wardParam);

            const Fuse = (await import('fuse.js')).default;
            const fuse = new Fuse(allVotersForWard, {
              keys: [searchField],
              threshold: 0.2, // Strict threshold
              ignoreLocation: true,
            });

            const fuzzyResults = fuse.search(query).map(result => result.item);
            voters = applyFuzzyPagination(fuzzyResults);
          }
        }
      } else {
        // If no query, just return a few recent ones, respecting ward
        let baseSql = `SELECT * FROM voters`;
        let countSql = `SELECT COUNT(*) as total FROM voters`;
        let params: any[] = [];
        
        if (ward) {
          baseSql += ` WHERE ward = ?`;
          countSql += ` WHERE ward = ?`;
          params = [parseInt(ward, 10)];
        } else if (allowedArr.length > 0) {
          const inClause = `WHERE ward IN (${allowedArr.map(() => '?').join(',')})`;
          baseSql += ` ${inClause}`;
          countSql += ` ${inClause}`;
          params = allowedArr;
        }
        
        voters = await executePaginatedSql(baseSql, countSql, params);
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

      return NextResponse.json({ 
        success: true, 
        data: voters,
        pagination: {
          currentPage,
          totalPages,
          totalItems,
          limit
        }
      });
    } finally {
      await db.close();
    }

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

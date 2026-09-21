import { NextResponse } from 'next/server';
import { getVotersDb, getAuthDb } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

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
  
  // Anti-Scraping: Strip SQL wildcard characters (% and _) from user query to prevent database dumping
  const rawQuery = (searchParams.get('q') || '').trim();
  const query = rawQuery.replace(/[%_]/g, '');
  const type = searchParams.get('type') || 'name'; // 'name', 'voter_id', 'house', 'serial'
  let ward = searchParams.get('ward') || ''; // optional ward filter

  try {
    const session: any = await getServerSession(authOptions);
    const role = session?.user?.role || 'public';
    const isAdmin = role === 'admin' || (session?.user?.email && process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL);
    const isPaid = role === 'paid';
    const isPrivileged = isAdmin || isPaid;

    // --- ANTI-SCRAPING & DATA LEAK DEFENSES ---

    // Rule 1: Public users (not logged in) can ONLY search by Voter ID
    if (role === 'public' && type !== 'voter_id') {
      return NextResponse.json({ 
        success: false, 
        error: 'Public users can only search by Voter ID. Please sign in with Google to search by Name.' 
      }, { status: 403 });
    }

    // Rule 2: Unauthenticated and guest users CANNOT browse or dump the database with an empty query
    if (!isPrivileged && !query) {
      return NextResponse.json({ 
        success: true, 
        data: [], 
        message: 'Please enter a search query (Voter ID, name, or house number).',
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0, limit: 25 }
      });
    }

    // Rule 3: Enforce minimum query length to prevent single-letter scraping sweeps
    if (!isPrivileged && query) {
      const minLength = (type === 'voter_id' || type === 'serial') ? 2 : 3;
      if (query.length < minLength) {
        return NextResponse.json({ 
          success: false, 
          error: `Search query too short. Please enter at least ${minLength} characters.` 
        }, { status: 400 });
      }
    }

    // Rule 4: Strict pagination clamping for non-privileged users
    let limit = Number(searchParams.get('limit')) || 25;
    if (!Number.isFinite(limit)) limit = 25;
    if (isPrivileged) {
      limit = Math.min(Math.max(1, limit), 100);
    } else {
      limit = Math.min(Math.max(1, limit), 25); // Max 25 rows per page for guests
    }

    let page = Number(searchParams.get('page')) || 1;
    if (!Number.isFinite(page) || page < 1) page = 1;

    // Rule 5: Hard cap on deep pagination for non-privileged users (Max 4 pages = 100 records max per search)
    if (!isPrivileged && page > 4) {
      return NextResponse.json({ 
        success: false, 
        error: 'Pagination limit reached. Please refine your search query for more specific results.',
        code: 'PAGE_LIMIT_EXCEEDED' 
      }, { status: 403 });
    }

    // --- RATE LIMITING LOGIC ---
    if (isPrivileged) {
      // TIER 3: ADMINS & PAID USERS - Unlimited total, but 25 requests per minute to prevent automated bot loops
      const rateLimitData = rateLimitMap.get(ip);
      const windowMs = 60 * 1000; // 1 minute
      if (rateLimitData) {
        if (now > rateLimitData.resetTime) {
          rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        } else {
          rateLimitData.count++;
          if (rateLimitData.count > 25) {
            return NextResponse.json({ 
              success: false, 
              error: 'Too many requests. Please wait a minute before searching again.', 
              code: 'RATE_LIMIT_ADMIN' 
            }, { status: 429 });
          }
        }
      } else {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      }
    } else {
      // TIER 1 & 2: PUBLIC and GUESTS - Persistent IP tracking in SQLite
      const userAgent = request.headers.get('user-agent') || 'unknown_ua';
      const clientIdentifier = `${ip}|${userAgent}`;

      const authDb = await getAuthDb();
      try {
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

        const quotaLimit = (role === 'guest' || role === 'user') ? 4 : 2; // Public gets 2, Guests get 4 total

        if (currentCount >= quotaLimit) {
          const code = role === 'guest' ? 'QUOTA_EXCEEDED_GUEST' : 'QUOTA_EXCEEDED_PUBLIC';
          return NextResponse.json({ 
            success: false, 
            error: 'Daily search limit exceeded.', 
            code 
          }, { status: 429 });
        }

        try {
          await authDb.run('UPDATE public_limits SET search_count = search_count + 1 WHERE ip = ?', [clientIdentifier]);
        } catch (dbErr) {
          console.error("Failed to update rate limit in DB:", dbErr);
        }
      } catch (authErr) {
        console.error("Auth DB rate limit error:", authErr);
      }
    }
    // --- END RATE LIMITING ---

    let allowedArr: number[] = [];
    
    // Only strictly enforce allowed_wards if they are a 'paid' user
    if (role === 'paid') {
      const allowed = session?.user?.allowed_wards;
      if (allowed === 'all') {
        // Allowed all wards
      } else if (allowed && allowed.trim() !== '') {
        allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
        if (ward && !allowedArr.includes(parseInt(ward, 10))) {
          return NextResponse.json({ success: false, error: 'Forbidden ward access' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: 'Your account has not been assigned to any wards. Please contact the administrator.' }, { status: 403 });
      }
    } else if (role === 'user' || role === 'guest') {
      const allowed = session?.user?.allowed_wards;
      if (allowed && allowed !== 'all' && allowed.trim() !== '') {
        allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
        if (ward && !allowedArr.includes(parseInt(ward, 10))) {
          return NextResponse.json({ success: false, error: 'Forbidden ward access' }, { status: 403 });
        }
      }
    }

    const db = await getVotersDb();

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
        if (type === 'voter_id') {
          const upperQuery = query.toUpperCase();
          const sqlParam = !isPrivileged ? upperQuery : `%${upperQuery}%`;
          const baseSql = `SELECT * FROM voters WHERE voter_id LIKE ? ${wardClause}`;
          const countSql = `SELECT COUNT(*) as total FROM voters WHERE voter_id LIKE ? ${wardClause}`;
          voters = await executePaginatedSql(baseSql, countSql, [sqlParam, ...wardParam]);
        } else if (type === 'house') {
          const sqlParam = !isPrivileged ? query : `%${query}%`;
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
            // Memory-Safe Unique Names Fuzzy Fallback:
            // Query only distinct names instead of pulling 50,000 full database objects into RAM
            const condition = wardClause ? `${wardClause.replace(/^AND\s+/i, '')} AND ${searchField} IS NOT NULL` : `${searchField} IS NOT NULL`;
            
            // Optimization: If searching globally across all 55 wards, prune candidate names by prefix
            // to avoid loading 15,000+ unique strings into Node.js memory.
            let uniqueNamesQuery = `SELECT DISTINCT ${searchField} as name FROM voters WHERE ${condition}`;
            let queryParams = [...wardParam];
            
            if (!ward && query.length >= 1) {
              uniqueNamesQuery += ` AND ${searchField} LIKE ?`;
              queryParams.push(`${query[0]}%`);
            }
            uniqueNamesQuery += ` LIMIT 1500`;

            const uniqueNameRows = await db.all(uniqueNamesQuery, queryParams);
            let uniqueNames = uniqueNameRows.map((r: any) => r.name).filter(Boolean);

            // Fallback: if prefix produced 0 candidates and query is longer than 1 char, try without prefix up to 1000
            if (uniqueNames.length === 0 && !ward) {
              const fallbackQuery = `SELECT DISTINCT ${searchField} as name FROM voters WHERE ${condition} LIMIT 1000`;
              const fallbackRows = await db.all(fallbackQuery, wardParam);
              uniqueNames = fallbackRows.map((r: any) => r.name).filter(Boolean);
            }

            if (uniqueNames.length === 0) {
              voters = [];
              totalItems = 0;
              totalPages = 0;
              currentPage = 1;
            } else {
              const FuseModule: any = await import('fuse.js');
              const Fuse = FuseModule.default || FuseModule;
              const fuse = new Fuse(uniqueNames, {
                threshold: 0.25,
                ignoreLocation: true,
              });

              const matchedResults = fuse.search(query);
              if (matchedResults.length > 0) {
                // Take top matched candidate names (up to top 5)
                const topMatchedNames = matchedResults.slice(0, 5).map((r: any) => r.item);
                const inPlaceholders = topMatchedNames.map(() => '?').join(',');
                
                // Rank results so the #1 closest fuzzy match appears first
                const orderCase = `ORDER BY CASE ${searchField} ` + 
                  topMatchedNames.map((name: string, idx: number) => `WHEN '${name.replace(/'/g, "''")}' THEN ${idx}`).join(' ') + 
                  ` ELSE ${topMatchedNames.length} END ASC`;

                const baseSql = `SELECT * FROM voters WHERE ${searchField} IN (${inPlaceholders}) ${wardClause} ${orderCase}`;
                const countSql = `SELECT COUNT(*) as total FROM voters WHERE ${searchField} IN (${inPlaceholders}) ${wardClause}`;
                voters = await executePaginatedSql(baseSql, countSql, [...topMatchedNames, ...wardParam]);
              } else {
                voters = [];
                totalItems = 0;
                totalPages = 0;
                currentPage = 1;
              }
            }
          }
        }
      } else {
        // Only privileged users (Admins / Paid Assigned) can browse without a query
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

      // Anti-Scraping / Privacy: Mask Voter ID and strip internal DB row IDs for non-privileged users
      if (!isPrivileged) {
        voters = voters.map((voter: any) => {
          const { id, ...safeRecord } = voter;
          let maskedId = '***';
          if (voter.voter_id && voter.voter_id.length > 4) {
            const v = voter.voter_id;
            maskedId = v.substring(0, 3) + '****' + v.substring(v.length - 3);
          }
          return { ...safeRecord, voter_id: maskedId };
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

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

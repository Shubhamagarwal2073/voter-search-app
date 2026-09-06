import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Simple in-memory rate limiter for Admins (25 requests per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function GET(request: Request) {
  let ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  const now = Date.now();
  const windowMs24h = 24 * 60 * 60 * 1000;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'name'; 
  let ward = searchParams.get('ward') || ''; 

  try {
    const session: any = await getServerSession(authOptions);
    const role = session?.user?.role || 'public';

    if (role === 'public' && query.length > 0 && type !== 'voter_id') {
      return NextResponse.json({ success: false, error: 'Public users can only search by Voter ID. Please sign in with Google to search by Name.' }, { status: 403 });
    }

    if (role === 'admin' || role === 'paid' || role === 'user' || (session?.user?.email && process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL)) {
      const rateLimitData = rateLimitMap.get(ip);
      const windowMs = 60 * 1000;
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
      // NOTE: Rate limiting for public users was SQLite based. 
      // For Vercel, this ideally requires Redis (Vercel KV) or a DB table. 
      // We will skip strict 24h DB limits here temporarily for the backup backend, 
      // relying on the in-memory map which works decently for single instances.
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

    let allowedArr: number[] = [];
    if (role === 'paid' || role === 'user') {
      const allowed = session?.user?.allowed_wards;
      if (allowed === 'all') {
      } else if (allowed && allowed.trim() !== '') {
        allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
        if (ward && !allowedArr.includes(parseInt(ward, 10))) {
          return NextResponse.json({ success: false, error: 'Forbidden ward access' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, error: 'Your account has not been assigned to any wards. Please contact the administrator.' }, { status: 403 });
      }
    }

    let voters: any[] = [];
    const wardParam = ward ? parseInt(ward, 10) : undefined;
    const wardFilter = wardParam ? { equals: wardParam } : allowedArr.length > 0 ? { in: allowedArr } : undefined;

    let whereClause: any = {};
    if (wardFilter) {
      whereClause.ward = wardFilter;
    }

    if (query) {
      if (type === 'voter_id') {
        const upperQuery = query.toUpperCase();
        whereClause.voter_id = { contains: upperQuery, mode: 'insensitive' };
      } else if (type === 'house') {
        whereClause.house_number = { contains: query, mode: 'insensitive' };
      } else if (type === 'serial') {
        whereClause.serial_number = parseInt(query, 10);
      } else if (type === 'name') {
        whereClause.name_hi = { contains: query, mode: 'insensitive' };
      } else if (type === 'relative_name') {
        whereClause.relative_name_hi = { contains: query, mode: 'insensitive' };
      }
      
      voters = await prisma.voter.findMany({
        where: whereClause,
        take: 50
      });
    } else {
      voters = await prisma.voter.findMany({
        where: whereClause,
        take: 10
      });
    }

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
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

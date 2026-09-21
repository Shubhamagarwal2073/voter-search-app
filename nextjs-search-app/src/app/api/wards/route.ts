import { NextResponse } from 'next/server';
import { getVotersDb } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions);
    const db = await getVotersDb();

    const wards = await db.all('SELECT DISTINCT ward FROM voters WHERE ward IS NOT NULL ORDER BY ward ASC');
    const countRow = await db.get('SELECT COUNT(*) as total FROM voters');
    
    let wardNumbers = wards.map(w => w.ward);
    
    // Filter wards based on user's allowed_wards
    if (session && session.user) {
      const role = (session.user as any).role;
      const allowed = (session.user as any).allowed_wards;
      
      if (role === 'paid') {
        if (!allowed || allowed.trim() === '') {
          wardNumbers = []; // Paid users with no wards assigned see nothing
        } else if (allowed !== 'all') {
          const allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
          wardNumbers = wardNumbers.filter(w => allowedArr.includes(w));
        }
      } else if (role === 'user' || role === 'guest') {
        // Guests can see all wards by default, unless specifically restricted
        if (allowed && allowed !== 'all' && allowed.trim() !== '') {
          const allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
          wardNumbers = wardNumbers.filter(w => allowedArr.includes(w));
        }
      }
    }

    return NextResponse.json({ success: true, data: wardNumbers, totalVoters: countRow.total });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

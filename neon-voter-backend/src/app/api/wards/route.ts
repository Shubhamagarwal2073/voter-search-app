import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions);

    try {
      const wards = await prisma.voter.groupBy({
        by: ['ward'],
        where: { ward: { not: null } },
        orderBy: { ward: 'asc' },
      });
      const countRow = await prisma.voter.count();
      
      let wardNumbers = wards.map(w => w.ward);
      
      // Filter wards based on user's allowed_wards
      if (session && session.user) {
        const allowed = (session.user as any).allowed_wards;
        if (allowed && allowed !== 'all') {
          const allowedArr = allowed.split(',').map((w: string) => parseInt(w.trim(), 10));
          wardNumbers = wardNumbers.filter(w => w !== null && allowedArr.includes(w));
        }
      }

      return NextResponse.json({ success: true, data: wardNumbers, totalVoters: countRow });
    } finally {
      await prisma.$disconnect();
    }

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

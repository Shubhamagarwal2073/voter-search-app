import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Group by ward to get aggregates
    const wardGroups = await prisma.voter.groupBy({
      by: ['ward'],
      _count: {
        _all: true
      },
    });

    const results = [];

    // 2. For each ward, get the detailed breakdown
    for (const group of wardGroups) {
      if (group.ward === null) continue;

      // Get gender counts
      const maleCount = await prisma.voter.count({
        where: { ward: group.ward, gender: { equals: 'Male', mode: 'insensitive' } }
      });
      const femaleCount = await prisma.voter.count({
        where: { ward: group.ward, gender: { equals: 'Female', mode: 'insensitive' } }
      });
      
      const otherCount = group._count._all - (maleCount + femaleCount);

      // Get serial numbers to find missing ones
      const votersInWard = await prisma.voter.findMany({
        where: { ward: group.ward },
        select: { serialNumber: true },
        orderBy: { serialNumber: 'asc' }
      });

      const serials = votersInWard
        .map(v => v.serialNumber)
        .filter((s): s is number => s !== null);

      let missing: number[] = [];
      if (serials.length > 0) {
        const maxSerial = serials[serials.length - 1];
        const serialSet = new Set(serials);
        
        // Find gaps from 1 to maxSerial
        for (let i = 1; i <= maxSerial; i++) {
          if (!serialSet.has(i)) {
            missing.push(i);
          }
        }
      }

      results.push({
        ward: group.ward,
        total: group._count._all,
        male: maleCount,
        female: femaleCount,
        other: otherCount,
        missing: missing
      });
    }

    // Sort by ward number
    results.sort((a, b) => a.ward - b.ward);

    return NextResponse.json({ success: true, data: results });

  } catch (error: any) {
    console.error('Database stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

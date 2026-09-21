import { NextResponse } from 'next/server';
import { getVotersDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getVotersDb();

    // 1. Get the aggregate counts per ward
    const statsQuery = `
      SELECT 
        ward,
        COUNT(*) as total,
        SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male,
        SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female,
        SUM(CASE WHEN gender != 'male' AND gender != 'female' THEN 1 ELSE 0 END) as other
      FROM voters 
      GROUP BY ward
      ORDER BY ward ASC
    `;
    const wardStats = await db.all(statsQuery);

    // 2. For each ward, get all serial numbers to calculate missing
    const results = [];
    
    for (const stat of wardStats) {
      if (!stat.ward) continue;
      
      const serialsResult = await db.all(
        `SELECT serial_number FROM voters WHERE ward = ? ORDER BY serial_number ASC`,
        [stat.ward]
      );
      
      const serials = serialsResult.map(row => row.serial_number).filter(s => s !== null && s !== undefined);
      
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
        ward: stat.ward,
        total: stat.total,
        male: stat.male || 0,
        female: stat.female || 0,
        other: stat.other || 0,
        missing: missing
      });
    }

    return NextResponse.json({ success: true, data: results });

  } catch (error: any) {
    console.error('Database stats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

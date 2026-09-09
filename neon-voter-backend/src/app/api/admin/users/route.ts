import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Helper to check admin
async function isAdmin() {
  const session: any = await getServerSession(authOptions);
  if (!session || !session.user || (session.user as any).role !== 'admin') {
    if (session?.user?.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) {
      return true;
    }
    return false;
  }
  return true;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'desc' },
      take: 500
    });
    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, allowed_wards } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const sanitizedEmail = email.trim().toLowerCase();
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });
    
    if (existingUser) {
      // Upgrade existing user to paid
      await prisma.user.update({
        where: { email: sanitizedEmail },
        data: { role: 'paid', allowed_wards: allowed_wards || '' }
      });
    } else {
      // Insert new user
      await prisma.user.create({
        data: {
          email: sanitizedEmail,
          role: 'paid',
          allowed_wards: allowed_wards || ''
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, allowed_wards } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { allowed_wards: allowed_wards || '' }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const session: any = await getServerSession(authOptions);
    const currentEmail = session?.user?.email?.toLowerCase();
    
    // Prevent accidental self-deletion or deleting other admins
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    if (targetUser.email === currentEmail || targetUser.role === 'admin') {
       return NextResponse.json({ error: 'Security constraint: Cannot delete an admin or yourself' }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

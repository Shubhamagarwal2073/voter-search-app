import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { authOptions } from '../auth/[...nextauth]/route';

// Assuming we need NextAuth options to get session, 
// a cleaner way is to create an authOptions object in [...nextauth] but for now we can just use getServerSession()

const dbPath = path.resolve(process.cwd(), 'data', 'auth.db');

async function getAuthDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// Helper to check admin
async function isAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || (session.user as any).role !== 'admin') {
    // If no session from DB, check if it's the environment admin email
    if (session?.user?.email === process.env.ADMIN_EMAIL) {
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
    const db = await getAuthDb();
    const users = await db.all(`SELECT id, email, role, allowed_wards FROM users`);
    await db.close();
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

    const db = await getAuthDb();
    const result = await db.run(
      `INSERT INTO users (email, role, allowed_wards) VALUES (?, 'user', ?)`,
      [email, allowed_wards || '']
    );
    await db.close();

    return NextResponse.json({ success: true, id: result.lastID });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }
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

    const db = await getAuthDb();
    await db.run(
      `UPDATE users SET allowed_wards = ? WHERE id = ?`,
      [allowed_wards, id]
    );
    await db.close();

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

    const db = await getAuthDb();
    await db.run(`DELETE FROM users WHERE id = ?`, [id]);
    await db.close();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

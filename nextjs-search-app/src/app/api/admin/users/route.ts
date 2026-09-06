import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { authOptions } from '../../auth/[...nextauth]/route';

// Assuming we need NextAuth options to get session, 
// a cleaner way is to create an authOptions object in [...nextauth] but for now we can just use getServerSession()

const dbPath = path.resolve(process.cwd(), 'data', 'auth.db');

let cachedDb: any = (global as any).sqliteDb || null;

async function getAuthDb() {
  if (cachedDb) return cachedDb;
  cachedDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  (global as any).sqliteDb = cachedDb;
  return cachedDb;
}

// Helper to check admin
async function isAdmin() {
  const session: any = await getServerSession(authOptions);
  if (!session || !session.user || (session.user as any).role !== 'admin') {
    // If no session from DB, check if it's the environment admin email
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
    const db = await getAuthDb();
    // Added LIMIT 500 to prevent massive memory payloads as the app scales
    const users = await db.all(`SELECT id, email, role, allowed_wards FROM users ORDER BY id DESC LIMIT 500`);
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
    const db = await getAuthDb();
    
    // Check if user already exists
    const existingUser = await db.get(`SELECT id FROM users WHERE email = ?`, [sanitizedEmail]);
    
    if (existingUser) {
      // Upgrade existing user to paid
      await db.run(
        `UPDATE users SET role = 'paid', allowed_wards = ? WHERE email = ?`,
        [allowed_wards || '', sanitizedEmail]
      );
    } else {
      // Insert new user
      await db.run(
        `INSERT INTO users (email, role, allowed_wards) VALUES (?, 'paid', ?)`,
        [sanitizedEmail, allowed_wards || '']
      );
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

    const db = await getAuthDb();
    await db.run(
      `UPDATE users SET allowed_wards = ? WHERE id = ?`,
      [allowed_wards || '', id]
    );

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

    const db = await getAuthDb();
    
    // Prevent accidental self-deletion or deleting other admins
    const targetUser = await db.get(`SELECT email, role FROM users WHERE id = ?`, [id]);
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    if (targetUser.email === currentEmail || targetUser.role === 'admin') {
       return NextResponse.json({ error: 'Security constraint: Cannot delete an admin or yourself' }, { status: 403 });
    }

    await db.run(`DELETE FROM users WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

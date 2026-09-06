import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { authOptions } from '../../auth/[...nextauth]/route';
import { Client } from 'pg';

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
    const { email, allowed_wards, syncToCloud } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const sanitizedEmail = email.trim().toLowerCase();
    
    // 1. NEON CLOUD SYNC (If checked)
    if (syncToCloud && process.env.DATABASE_URL) {
      const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        
        // Check if exists in Neon
        const res = await client.query('SELECT id FROM "User" WHERE email = $1', [sanitizedEmail]);
        if (res.rows.length > 0) {
          await client.query(
            'UPDATE "User" SET role = $1, allowed_wards = $2 WHERE email = $3',
            ['paid', allowed_wards || '', sanitizedEmail]
          );
        } else {
          await client.query(
            'INSERT INTO "User" (email, role, allowed_wards) VALUES ($1, $2, $3)',
            [sanitizedEmail, 'paid', allowed_wards || '']
          );
        }
        await client.end();
      } catch (err: any) {
        // STRICT FAULT TOLERANCE: Throw error and abort local save
        if (client) await client.end().catch(() => {});
        console.error("Neon DB Sync Failed:", err);
        return NextResponse.json({ error: `Cloud sync failed: ${err.message}. Uncheck "Sync to Cloud Backup" if you want to bypass Neon DB and save locally only.` }, { status: 502 });
      }
    }

    // 2. LOCAL SQLITE SAVE (Executes only if cloud sync was successful or unchecked)
    const db = await getAuthDb();
    const existingUser = await db.get(`SELECT id FROM users WHERE email = ?`, [sanitizedEmail]);
    
    if (existingUser) {
      await db.run(
        `UPDATE users SET role = 'paid', allowed_wards = ? WHERE email = ?`,
        [allowed_wards || '', sanitizedEmail]
      );
    } else {
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
    const { id, allowed_wards, syncToCloud } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const db = await getAuthDb();
    const targetUser = await db.get(`SELECT email FROM users WHERE id = ?`, [id]);
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 1. NEON CLOUD SYNC
    if (syncToCloud && process.env.DATABASE_URL) {
      const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        await client.query(
          'UPDATE "User" SET allowed_wards = $1 WHERE email = $2',
          [allowed_wards || '', targetUser.email]
        );
        await client.end();
      } catch (err: any) {
        if (client) await client.end().catch(() => {});
        return NextResponse.json({ error: `Cloud sync failed: ${err.message}. Uncheck "Sync to Cloud Backup" if you want to bypass Neon DB.` }, { status: 502 });
      }
    }

    // 2. LOCAL SQLITE SAVE
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
    const syncToCloud = searchParams.get('syncToCloud') === 'true';
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

    // 1. NEON CLOUD SYNC
    if (syncToCloud && process.env.DATABASE_URL) {
      const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        await client.query('DELETE FROM "User" WHERE email = $1', [targetUser.email]);
        await client.end();
      } catch (err: any) {
        if (client) await client.end().catch(() => {});
        return NextResponse.json({ error: `Cloud sync failed: ${err.message}. Uncheck "Sync to Cloud Backup" if you want to bypass Neon DB.` }, { status: 502 });
      }
    }

    // 2. LOCAL SQLITE SAVE
    await db.run(`DELETE FROM users WHERE id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// Force dynamic
export const dynamic = 'force-dynamic';

async function openLocalDb() {
  const dbPath = path.resolve(process.cwd(), 'data', 'auth.db');
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// Defense-in-depth: Strict admin verification directly in the API handler
async function verifyAdmin() {
  const session: any = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin' || (session?.user?.email && process.env.ADMIN_EMAIL && session.user.email === process.env.ADMIN_EMAIL);
  return isAdmin;
}

// GET all auth users
export async function GET() {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const db = await openLocalDb();
    
    // Read from users table
    const users = await db.all(`
      SELECT id, name, email, image, role, allowed_wards 
      FROM users 
      ORDER BY id DESC
    `);
    
    await db.close();
    return NextResponse.json(users);
  } catch (error: any) {
    console.error("Local DB read error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE an auth user (with dual-sync logic)
export async function PUT(request: Request) {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, email, role, allowed_wards, syncToNeon } = body;

    if (!id || !email) {
      return NextResponse.json({ error: "Missing id or email" }, { status: 400 });
    }

    // 1. Update Local auth.db safely
    const localDb = await openLocalDb();
    await localDb.run(
      `UPDATE users SET name = ?, email = ?, role = ?, allowed_wards = ? WHERE id = ?`,
      [name, email, role, allowed_wards, id]
    );
    await localDb.close();

    // 2. Dual-Sync logic: Try to sync to Neon if enabled
    let neonSyncFailed = false;
    let neonErrorMsg = "";

    if (syncToNeon) {
      try {
        if (process.env.NEON_DATABASE_URL) {
          const { Client } = require('pg');
          const client = new Client({
            connectionString: process.env.NEON_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
          });
          
          await client.connect();
          await client.query(
            `UPDATE users SET name = $1, email = $2, role = $3, allowed_wards = $4 WHERE id = $5`,
            [name, email, role, allowed_wards, id]
          );
          await client.end();
        } else {
            throw new Error("NEON_DATABASE_URL is not configured.");
        }
      } catch (err: any) {
        console.error("Neon DB Sync Failed:", err);
        neonSyncFailed = true;
        neonErrorMsg = err.message || "Failed to connect to Neon Cloud.";
      }
    }

    if (neonSyncFailed) {
      return NextResponse.json({ 
        success: true, 
        neonFailed: true, 
        message: `Saved locally in auth.db safely, but Neon sync failed: ${neonErrorMsg}. Try again or uncheck Sync to bypass.`
      });
    }

    return NextResponse.json({ success: true, message: "User updated successfully." });
  } catch (error: any) {
    console.error("Update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// CREATE an auth user (with dual-sync logic)
export async function POST(request: Request) {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, allowed_wards, syncToNeon } = body;

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // 1. Insert Local auth.db safely
    const localDb = await openLocalDb();
    
    // Check if user already exists
    const existing = await localDb.get(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) {
      await localDb.close();
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }
    
    await localDb.run(
      `INSERT INTO users (name, email, role, allowed_wards) VALUES (?, ?, ?, ?)`,
      [name, email, role, allowed_wards]
    );
    await localDb.close();

    // 2. Dual-Sync logic: Try to sync to Neon if enabled
    let neonSyncFailed = false;
    let neonErrorMsg = "";

    if (syncToNeon) {
      try {
        if (process.env.NEON_DATABASE_URL) {
          const { Client } = require('pg');
          const client = new Client({
            connectionString: process.env.NEON_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
          });
          
          await client.connect();
          await client.query(
            `INSERT INTO users (name, email, role, allowed_wards) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
            [name, email, role, allowed_wards]
          );
          await client.end();
        } else {
            throw new Error("NEON_DATABASE_URL is not configured.");
        }
      } catch (err: any) {
        console.error("Neon DB Sync Failed:", err);
        neonSyncFailed = true;
        neonErrorMsg = err.message || "Failed to connect to Neon Cloud.";
      }
    }

    if (neonSyncFailed) {
      return NextResponse.json({ 
        success: true, 
        neonFailed: true, 
        message: `Saved locally in auth.db safely, but Neon sync failed: ${neonErrorMsg}. Try again or uncheck Sync to bypass.`
      });
    }

    return NextResponse.json({ success: true, message: "User created successfully." });
  } catch (error: any) {
    console.error("Create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // 1. DELETE FROM LOCAL auth.db
    const db = await openLocalDb();
    await db.run("DELETE FROM users WHERE id = ?", [id]);
    await db.close();

    // 2. DELETE FROM NEON DB (Optional / Best Effort)
    let neonSyncFailed = false;
    let neonErrorMsg = "";
    
    try {
      if (process.env.NEON_DATABASE_URL && email) {
        const { Client } = require('pg');
        const client = new Client({
          connectionString: process.env.NEON_DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        await client.query("DELETE FROM users WHERE email = $1", [email]);
        await client.end();
      }
    } catch (err: any) {
      console.error("Neon DB Sync Failed on Delete:", err);
      neonSyncFailed = true;
      neonErrorMsg = err.message || "Failed to delete from Neon Cloud.";
    }

    if (neonSyncFailed) {
      return NextResponse.json({ 
        success: true, 
        neonFailed: true, 
        message: `Deleted locally from auth.db safely, but Neon sync failed: ${neonErrorMsg}.`
      });
    }

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

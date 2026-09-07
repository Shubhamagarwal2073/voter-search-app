import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// Force dynamic
export const dynamic = 'force-dynamic';

async function openLocalDb() {
  const dbPath = path.resolve(process.cwd(), 'data', 'auth.db');
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// GET all auth users
export async function GET() {
  try {
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
        // Here we simulate the Neon connection sync using Neon's connection string
        // Since we are inside the Vercel backend we would typically use 'pg' or '@neondatabase/serverless'
        // But for this example, we'll try to hit an internal Neon migration endpoint, or use the Neon URL
        
        // Let's assume Neon URL is in process.env.NEON_DATABASE_URL
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
      // The local save was successful, but Neon dropped.
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

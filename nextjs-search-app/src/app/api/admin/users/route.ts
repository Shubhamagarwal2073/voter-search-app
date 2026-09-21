import { NextResponse } from 'next/server';
import { getAuthDb } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

// Force dynamic
export const dynamic = 'force-dynamic';

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

    const db = await getAuthDb();
    
    // Read from users table
    const users = await db.all(`
      SELECT id, name, email, image, role, allowed_wards 
      FROM users 
      ORDER BY id DESC
    `);
    
    return NextResponse.json(users);
  } catch (error: any) {
    console.error("Local DB read error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE an auth user
export async function PUT(request: Request) {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, email, role, allowed_wards } = body;

    if (!id || !email) {
      return NextResponse.json({ error: "User ID and Email are required." }, { status: 400 });
    }

    const db = await getAuthDb();
    await db.run(`
      UPDATE users 
      SET name = ?, email = ?, role = ?, allowed_wards = ?
      WHERE id = ?
    `, [name, email, role, allowed_wards, id]);

    return NextResponse.json({ 
      success: true, 
      message: "User updated successfully in auth.db." 
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// CREATE a new auth user
export async function POST(request: Request) {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, allowed_wards } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const db = await getAuthDb();
    
    // Check if user already exists
    const existing = await db.get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    const result = await db.run(`
      INSERT INTO users (name, email, role, allowed_wards)
      VALUES (?, ?, ?, ?)
    `, [name, email, role, allowed_wards]);

    return NextResponse.json({ 
      success: true, 
      id: result.lastID,
      message: "User created successfully in auth.db." 
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE an auth user
export async function DELETE(req: Request) {
  try {
    const isAuthorized = await verifyAdmin();
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    const db = await getAuthDb();
    await db.run("DELETE FROM users WHERE id = ?", [id]);

    return NextResponse.json({ 
      success: true, 
      message: "User deleted successfully from auth.db." 
    });
  } catch (error: any) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

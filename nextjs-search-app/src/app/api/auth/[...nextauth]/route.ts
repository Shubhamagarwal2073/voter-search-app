import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// Store DB inside Next.js data folder
const dbPath = path.resolve(process.cwd(), 'data', 'auth.db');

async function getAuthDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

export const authOptions: any = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (user.email) {
        const db = await getAuthDb();
        const existingUser = await db.get(`SELECT * FROM users WHERE email = ?`, [user.email]);
        
        // If no user exists, but it's the admin email, we allow it (and create it in db maybe?)
        // Let's just check if it's the initial admin email.
        if (!existingUser && user.email === process.env.ADMIN_EMAIL) {
          await db.run(`INSERT INTO users (email, role, allowed_wards) VALUES (?, 'admin', 'all')`, [user.email]);
          await db.close();
          return true;
        }

        await db.close();
        if (existingUser) {
          return true;
        } else {
          // Unauthorized users cannot sign in
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user }: any) {
      if (token.email) {
        const db = await getAuthDb();
        const existingUser = await db.get(`SELECT * FROM users WHERE email = ?`, [token.email]);
        await db.close();
        if (existingUser) {
          token.role = existingUser.role;
          token.allowed_wards = existingUser.allowed_wards;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).allowed_wards = token.allowed_wards;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

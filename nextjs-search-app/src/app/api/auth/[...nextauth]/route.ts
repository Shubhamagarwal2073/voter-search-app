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
        
        if (!existingUser) {
          // If no user exists, we auto-enroll them as a 'guest'
          const role = user.email === process.env.ADMIN_EMAIL ? 'admin' : 'guest';
          const allowed_wards = role === 'admin' ? 'all' : '';
          await db.run(`INSERT INTO users (email, role, allowed_wards) VALUES (?, ?, ?)`, [user.email, role, allowed_wards]);
        }

        await db.close();
        return true; // We now allow everyone who has a valid Google account to log in!
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

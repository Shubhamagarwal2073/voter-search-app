import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
        const sanitizedEmail = user.email.trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({
          where: { email: sanitizedEmail }
        });
        
        if (!existingUser) {
          const role = sanitizedEmail === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'guest';
          const allowed_wards = role === 'admin' ? 'all' : '';
          await prisma.user.create({
            data: {
              email: sanitizedEmail,
              role: role,
              allowed_wards: allowed_wards
            }
          });
        }
        return true;
      }
      return false;
    },
    async jwt({ token, user }: any) {
      if (token.email) {
        const sanitizedEmail = token.email.trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({
          where: { email: sanitizedEmail }
        });
        
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
  },
  pages: {
    signIn: '/login',
  }
};

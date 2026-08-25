import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    
    // We only reach here if the user is accessing a matched route (e.g., /admin)
    const isAdmin = token?.role === "admin" || token?.email === process.env.ADMIN_EMAIL;

    if (!isAdmin && (path.startsWith("/admin") || path.startsWith("/api/admin"))) {
      // If a non-admin tries to access admin routes, kick them to the home page
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// ONLY protect the admin routes. Everything else is public!
export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*"
  ],
};

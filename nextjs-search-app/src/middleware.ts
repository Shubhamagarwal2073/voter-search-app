import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isAdmin = token?.role === "admin" || token?.email === process.env.ADMIN_EMAIL;

    if (isAdmin) {
      // Admins are only allowed on /admin, not on / (platform)
      if (path !== "/admin" && !path.startsWith("/api/admin")) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    } else {
      // Normal users are only allowed on / (platform), not on /admin
      if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Protect all routes except the auth api and static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, icons (public folder)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};

import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Allow the request to proceed
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Only allow authenticated users
        // This blocks ALL pages for non-authenticated users
        return !!token
      },
    },
  }
)

// Apply middleware to all routes except auth routes and static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth/* (NextAuth routes)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     * - /robots.txt (robots file)
     * - /api/health (health check)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|api/health).*)",
  ],
}
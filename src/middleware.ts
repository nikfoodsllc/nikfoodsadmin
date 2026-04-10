import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login'];

// Define routes that should redirect to dashboard if authenticated
const _authRoutes = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, images, and Next.js internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next();
  }

  // Note: Since we're using localStorage for tokens (not cookies),
  // middleware cannot access them. We rely on client-side auth guards instead.
  // Middleware only handles basic routing logic.

  // Check if route is public
  const _isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Allow all routes to pass through
  // Client-side auth guards in AdminLayout will handle authentication checks
  return NextResponse.next();
}

// Configure which routes should be handled by this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};

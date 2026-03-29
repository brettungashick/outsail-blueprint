import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import type { UserRole } from '@/types'

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/login', '/verify']

// Role-based route access rules
const ROUTE_ROLE_RULES: Array<{
  prefix: string
  allowedRoles: UserRole[]
}> = [
  // Advisor/admin dashboard and project management
  { prefix: '/dashboard', allowedRoles: ['admin', 'advisor'] },
  // API project management — same as dashboard
  { prefix: '/api/projects', allowedRoles: ['admin', 'advisor'] },
  // Client workspace
  { prefix: '/workspace', allowedRoles: ['admin', 'client'] },
  // Admin-only settings
  { prefix: '/settings', allowedRoles: ['admin'] },
]

// All prefixes that require authentication (superset of role-protected routes)
const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/settings', '/workspace', '/api/projects']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const session = sessionCookie?.value
    ? await verifySessionToken(sessionCookie.value)
    : null

  const isApiRoute = pathname.startsWith('/api/')

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !session) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect already-authenticated users away from auth routes
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access control for authenticated users on protected routes
  if (session && isProtectedRoute) {
    const userRole = session.role as UserRole

    // Find the most specific matching rule
    const matchingRule = ROUTE_ROLE_RULES.find((rule) =>
      pathname.startsWith(rule.prefix)
    )

    if (matchingRule && !matchingRule.allowedRoles.includes(userRole)) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const unauthorizedUrl = new URL('/login', request.url)
      unauthorizedUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(unauthorizedUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) — EXCEPT api/projects which requires auth
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

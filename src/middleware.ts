import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import type { UserRole } from '@/types'

// ─── Always-public paths ──────────────────────────────────────────────────────
// These NEVER run auth checks. No session cookie is read, no redirect is issued.
// /login and /verify are here intentionally — making them public eliminates any
// possibility of a loop between "redirect to /login" and "redirect away from /login".
const ALWAYS_PUBLIC_PREFIXES = ['/_next/', '/api/auth/', '/fonts/']
const ALWAYS_PUBLIC_EXACT = new Set(['/login', '/verify', '/favicon.ico'])

// ─── Role-based access rules ──────────────────────────────────────────────────
const ROLE_RULES: Array<{ prefix: string; allowedRoles: UserRole[] }> = [
  { prefix: '/dashboard', allowedRoles: ['admin', 'advisor'] },
  { prefix: '/workspace', allowedRoles: ['admin', 'client'] },
  { prefix: '/settings', allowedRoles: ['admin'] },
  { prefix: '/api/projects', allowedRoles: ['admin', 'advisor'] },
]

// Prefixes that require an authenticated session
const REQUIRES_AUTH_PREFIXES = ['/dashboard', '/workspace', '/settings', '/api/projects']

// Map role → default landing page after auth
function roleHome(role: UserRole): string {
  if (role === 'client') return '/workspace'
  if (role === 'admin' || role === 'advisor') return '/dashboard'
  // vendor / unknown: no protected home — send back to login
  return '/login'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Always-public: passthrough immediately, no cookie read ─────────────
  if (
    ALWAYS_PUBLIC_EXACT.has(pathname) ||
    ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    console.log(`[mw] PUBLIC path=${pathname}`)
    return NextResponse.next()
  }

  // ── 2. Resolve session (only for non-public paths) ────────────────────────
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const session = sessionCookie?.value
    ? await verifySessionToken(sessionCookie.value)
    : null
  const role = session?.role as UserRole | undefined

  console.log(`[mw] path=${pathname} session=${role ?? 'anon'}`)

  // ── 3. Root / → redirect to appropriate home ──────────────────────────────
  if (pathname === '/') {
    const dest = role ? roleHome(role) : '/login'
    console.log(`[mw] ROOT path=/ role=${role ?? 'anon'} → ${dest}`)
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // ── 4. Protected routes ───────────────────────────────────────────────────
  const requiresAuth = REQUIRES_AUTH_PREFIXES.some((p) => pathname.startsWith(p))

  if (requiresAuth) {
    // 4a. No session → 401 (API) or redirect to /login (page)
    if (!session) {
      if (pathname.startsWith('/api/')) {
        console.log(`[mw] UNAUTH API path=${pathname} → 401`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      console.log(`[mw] UNAUTH path=${pathname} → /login?redirect=${pathname}`)
      return NextResponse.redirect(loginUrl)
    }

    // 4b. Session present → RBAC check
    const matchingRule = ROLE_RULES.find((r) => pathname.startsWith(r.prefix))

    if (matchingRule && !matchingRule.allowedRoles.includes(role!)) {
      if (pathname.startsWith('/api/')) {
        console.log(`[mw] FORBIDDEN API path=${pathname} role=${role} → 403`)
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Redirect to the user's home, NOT to /login.
      // Redirecting to /login would create a loop:
      //   forbidden route → /login → (authenticated, so redirect to home) → forbidden again
      const home = roleHome(role!)

      // Anti-loop guard: if the user is already at (or inside) their home, just pass.
      // This prevents home=/dashboard + path=/dashboard/x from looping.
      if (home !== '/login' && pathname.startsWith(home)) {
        console.log(`[mw] RBAC already-at-home path=${pathname} role=${role} → passthrough`)
        return NextResponse.next()
      }

      console.log(`[mw] FORBIDDEN path=${pathname} role=${role} → ${home}`)
      return NextResponse.redirect(new URL(home, request.url))
    }

    // 4c. Authenticated + role allowed → passthrough
    console.log(`[mw] ALLOWED path=${pathname} role=${role}`)
  }

  // ── 5. All other paths: pass through ──────────────────────────────────────
  console.log(`[mw] PASS path=${pathname}`)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Run middleware on all paths EXCEPT:
     * - _next/static  (compiled assets)
     * - _next/image   (image optimisation)
     * - favicon.ico   (also in ALWAYS_PUBLIC_EXACT above, but excluded here for efficiency)
     * - Common static file extensions
     *
     * Note: _next/data/ is intentionally included so RSC navigation calls
     * go through auth checks when they share a protected route path.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|woff|ttf)$).*)',
  ],
}

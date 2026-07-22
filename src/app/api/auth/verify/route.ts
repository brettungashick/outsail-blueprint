import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { verifyMagicToken, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { canStartSession } from '@/lib/auth/access'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days in seconds

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_token`)
  }

  // Verify the magic link JWT
  const payload = await verifyMagicToken(token)
  if (!payload) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_token`)
  }

  try {
    // Look up the user. We NEVER auto-create here: a valid magic link only
    // proves control of an email address, not that the address was ever
    // invited. Only pre-existing (explicitly provisioned/invited) users may
    // receive a session. Unknown emails are rejected.
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .get()

    if (!canStartSession(user)) {
      const reason = user ? 'account_deactivated' : 'unknown_email'
      console.warn('[auth/verify] rejected session for', payload.email, '-', reason)
      return NextResponse.redirect(`${appUrl}/login?error=${reason}`)
    }

    // Create a 30-day session token
    const sessionToken = await createSessionToken(
      user.id,
      user.email,
      user.role as 'admin' | 'advisor' | 'client' | 'vendor'
    )

    // Build redirect response and set httpOnly session cookie
    // Support ?redirect= param for stakeholder deep links — only allow internal paths
    const rawRedirect = searchParams.get('redirect') ?? ''
    const safeRedirect =
      rawRedirect && (rawRedirect.startsWith('/workspace/') || rawRedirect.startsWith('/dashboard/'))
        ? rawRedirect
        : null
    const landingPath = safeRedirect ?? (user.role === 'client' ? '/workspace' : '/dashboard')
    const response = NextResponse.redirect(`${appUrl}${landingPath}`)
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/verify] DB error:', err)
    return NextResponse.redirect(`${appUrl}/login?error=server_error`)
  }
}

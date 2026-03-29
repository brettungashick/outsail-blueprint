import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { verifyMagicToken, createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
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
    // Look up or create the user
    let user = await db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .get()

    if (!user) {
      const inserted = await db
        .insert(users)
        .values({
          email: payload.email,
          role: 'advisor',
        })
        .returning()
        .get()

      if (!inserted) {
        console.error('[auth/verify] Failed to insert new user for', payload.email)
        return NextResponse.redirect(`${appUrl}/login?error=server_error`)
      }

      user = inserted
    }

    // Create a 30-day session token
    const sessionToken = await createSessionToken(
      user.id,
      user.email,
      user.role as 'admin' | 'advisor' | 'client' | 'vendor'
    )

    // Build redirect response and set httpOnly session cookie
    // Client-role users land on /workspace; everyone else on /dashboard
    const landingPath = user.role === 'client' ? '/workspace' : '/dashboard'
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

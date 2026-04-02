import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; password?: string }
  const email = body.email?.trim().toLowerCase()
  const password = body.password

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user || !user.password_hash) {
    // Consistent response time to prevent user enumeration
    await bcrypt.compare('dummy', '$2b$10$dummyhashfortimingatk0000000000000000000000')
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  // Only advisors and admins can use password auth
  if (user.role === 'client' || user.role === 'vendor') {
    return NextResponse.json({ error: 'Password login is not available for this account type.' }, { status: 403 })
  }

  const sessionToken = await createSessionToken(user.id, user.email, user.role as 'admin' | 'advisor')

  const response = NextResponse.json({
    ok: true,
    mustChangePassword: user.must_change_password ?? false,
    redirectTo: user.must_change_password ? '/dashboard/settings/change-password' : '/dashboard',
  })

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return response
}

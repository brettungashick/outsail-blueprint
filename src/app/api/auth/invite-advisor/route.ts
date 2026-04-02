import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { sendNotification } from '@/lib/email/send-notification'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hrisblueprint.com'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: NextRequest) {
  // Require admin auth
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json() as { name?: string; email?: string }
  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
  }

  // Check if user already exists
  const existing = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).get()
  if (existing) {
    return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 })
  }

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const id = createId()
  await db.insert(users).values({
    id,
    email,
    name: name ?? null,
    role: 'advisor',
    password_hash: passwordHash,
    must_change_password: true,
  })

  // Send invite email (non-fatal)
  try {
    await sendNotification({
      to: email,
      subject: 'You\'ve been invited to OutSail Blueprint',
      heading: 'Welcome to OutSail Blueprint',
      body: `${name ? `Hi ${name},\n\n` : ''}You\'ve been added as an advisor on OutSail Blueprint. Sign in with your email and the temporary password below, then you\'ll be prompted to set your own password.\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nThis password should be changed on first login.`,
      ctaText: 'Sign In',
      ctaUrl: `${APP_URL}/login`,
    })
  } catch (err) {
    console.error('[invite-advisor] Email send failed:', err)
  }

  return NextResponse.json({ ok: true, userId: id, tempPassword })
}

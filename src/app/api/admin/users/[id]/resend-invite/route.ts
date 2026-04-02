import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { sendNotification } from '@/lib/email/send-notification'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hrisblueprint.com'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const user = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, params.id))
    .get()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'client') return NextResponse.json({ error: 'Cannot resend invite to client users' }, { status: 400 })

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  await db
    .update(users)
    .set({ password_hash: passwordHash, must_change_password: true, updated_at: new Date() })
    .where(eq(users.id, params.id))

  try {
    await sendNotification({
      to: user.email,
      subject: 'Your OutSail Blueprint invitation',
      heading: 'Welcome to OutSail Blueprint',
      body: `${user.name ? `Hi ${user.name},\n\n` : ''}Your invitation to OutSail Blueprint has been resent. Sign in with your email and the temporary password below, then set your own password.\n\nEmail: ${user.email}\nTemporary password: ${tempPassword}`,
      ctaText: 'Sign In',
      ctaUrl: `${APP_URL}/login`,
    })
  } catch (err) {
    console.error('[resend-invite] Email send failed:', err)
  }

  return NextResponse.json({ ok: true, tempPassword })
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { currentPassword?: string; newPassword?: string }
  const { currentPassword, newPassword } = body

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
  }

  const user = await db.select().from(users).where(eq(users.id, session.userId)).get()
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  // If user already has a password, require current password verification
  if (user.password_hash) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required.' }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }
  }

  const newHash = await bcrypt.hash(newPassword, 10)

  await db
    .update(users)
    .set({ password_hash: newHash, must_change_password: false, updated_at: new Date() })
    .where(eq(users.id, user.id))

  return NextResponse.json({ ok: true })
}

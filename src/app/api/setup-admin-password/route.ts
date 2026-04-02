import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

export const dynamic = 'force-dynamic'

const SETUP_SECRET = 'outsail-init-2026'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  if (searchParams.get('secret') !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = searchParams.get('email')
  const password = searchParams.get('password')

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Missing required params: email, password' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  let user = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()

  if (user) {
    await db
      .update(users)
      .set({ role: 'admin', password_hash: passwordHash, must_change_password: false, updated_at: new Date() })
      .where(eq(users.id, user.id))
    user = await db.select().from(users).where(eq(users.id, user.id)).get()
  } else {
    const id = createId()
    await db.insert(users).values({
      id,
      email: email.toLowerCase(),
      role: 'admin',
      password_hash: passwordHash,
      must_change_password: false,
    })
    user = await db.select().from(users).where(eq(users.id, id)).get()
  }

  return NextResponse.json({ ok: true, message: `Admin password set for ${email}`, userId: user?.id })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const SETUP_SECRET = 'outsail-init-2026'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  if (searchParams.get('secret') !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const email = searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Missing required query param: email' }, { status: 400 })
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  await db
    .update(users)
    .set({ role: 'admin', updated_at: new Date() })
    .where(eq(users.id, user.id))

  const updated = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .get()

  return NextResponse.json({ ok: true, user: updated })
}

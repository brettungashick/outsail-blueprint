import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await request.json() as { role?: string; name?: string }
  const patch: Record<string, unknown> = { updated_at: new Date() }

  if (body.role && ['admin', 'advisor', 'client', 'vendor'].includes(body.role)) {
    patch.role = body.role
  }
  if ('name' in body) patch.name = body.name ?? null

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  await db.update(users).set(patch).where(eq(users.id, params.id))

  const updated = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
  }).from(users).where(eq(users.id, params.id)).get()

  return NextResponse.json({ ok: true, user: updated })
}

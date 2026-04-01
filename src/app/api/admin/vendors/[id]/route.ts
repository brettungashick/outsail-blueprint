import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { is_active?: boolean }

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
  }

  try {
    await db
      .update(vendors)
      .set({ is_active: body.is_active, updated_at: new Date() })
      .where(eq(vendors.id, params.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/vendors/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

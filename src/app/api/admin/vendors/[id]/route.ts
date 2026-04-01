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

  const body = await request.json() as {
    is_active?: boolean
    logo_url?: string | null
    primary_color?: string | null
  }

  const patch: Partial<{
    is_active: boolean
    logo_url: string | null
    primary_color: string | null
    updated_at: Date
  }> = { updated_at: new Date() }

  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if ('logo_url' in body) patch.logo_url = body.logo_url ?? null
  if ('primary_color' in body) patch.primary_color = body.primary_color ?? null

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    await db.update(vendors).set(patch).where(eq(vendors.id, params.id))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/vendors/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

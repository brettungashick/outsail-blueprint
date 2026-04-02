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
    product_name?: string
    vendor_company?: string | null
    website?: string | null
    is_active?: boolean
    can_be_primary?: boolean
    logo_url?: string | null
    primary_color?: string | null
    suggested_categories?: string[]
  }

  const patch: Record<string, unknown> = { updated_at: new Date() }

  if (body.product_name !== undefined) patch.product_name = body.product_name
  if ('vendor_company' in body) patch.vendor_company = body.vendor_company ?? null
  if ('website' in body) patch.website = body.website ?? null
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (typeof body.can_be_primary === 'boolean') patch.can_be_primary = body.can_be_primary
  if ('logo_url' in body) patch.logo_url = body.logo_url ?? null
  if ('primary_color' in body) patch.primary_color = body.primary_color ?? null
  if (Array.isArray(body.suggested_categories)) {
    patch.suggested_categories = JSON.stringify(body.suggested_categories)
  }

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

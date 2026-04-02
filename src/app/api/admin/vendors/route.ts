import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as {
    product_name: string
    vendor_company?: string | null
    website?: string | null
    can_be_primary?: boolean
    suggested_categories?: string[]
    logo_url?: string | null
    primary_color?: string | null
    is_active?: boolean
  }

  if (!body.product_name?.trim()) {
    return NextResponse.json({ error: 'product_name is required' }, { status: 400 })
  }

  try {
    const now = new Date()
    const id = makeId()
    await db.insert(vendors).values({
      id,
      product_name: body.product_name.trim(),
      vendor_company: body.vendor_company ?? null,
      website: body.website ?? null,
      can_be_primary: body.can_be_primary ?? false,
      suggested_categories: body.suggested_categories
        ? JSON.stringify(body.suggested_categories)
        : null,
      logo_url: body.logo_url ?? null,
      primary_color: body.primary_color ?? null,
      is_active: body.is_active ?? true,
      created_at: now,
      updated_at: now,
    })
    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('[admin/vendors] POST error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

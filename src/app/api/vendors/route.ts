import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.toLowerCase() ?? ''
  const canBePrimaryParam = searchParams.get('can_be_primary')
  const category = searchParams.get('category')?.toLowerCase() ?? ''

  const t0 = Date.now()

  try {
    // Start with all active vendors
    let rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.is_active, true))
      .all()

    console.log(`[/api/vendors] total active rows: ${rows.length} (${Date.now() - t0}ms)`)

    // Filter by can_be_primary
    if (canBePrimaryParam === 'true') {
      rows = rows.filter((v) => v.can_be_primary)
    } else if (canBePrimaryParam === 'false') {
      rows = rows.filter((v) => !v.can_be_primary)
    }

    // Filter by category — use substring matching so short canvas module names
    // (e.g. "Core HR") match longer seed-data strings ("Core HR / Employee Files")
    if (category) {
      rows = rows.filter((v) => {
        if (!v.suggested_categories) return false
        try {
          const cats = JSON.parse(v.suggested_categories) as string[]
          return cats.some(
            (c) =>
              c.toLowerCase().includes(category) ||
              category.includes(c.toLowerCase())
          )
        } catch {
          return false
        }
      })
    }

    // Filter by search query
    if (q) {
      rows = rows.filter(
        (v) =>
          v.product_name.toLowerCase().includes(q) ||
          (v.vendor_company?.toLowerCase().includes(q) ?? false)
      )
    }

    // Limit to 100 results for client-facing combobox
    rows = rows.slice(0, 100)

    // Parse suggested_categories back to arrays for response
    const result = rows.map((v) => ({
      id: v.id,
      product_name: v.product_name,
      vendor_company: v.vendor_company,
      website: v.website,
      logo_url: v.logo_url,
      primary_color: v.primary_color,
      can_be_primary: v.can_be_primary,
      suggested_categories: v.suggested_categories
        ? (() => { try { return JSON.parse(v.suggested_categories!) as string[] } catch { return [] } })()
        : [],
    }))

    return NextResponse.json({ vendors: result, total: result.length })
  } catch (err) {
    console.error('[/api/vendors] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch vendors', vendors: [] }, { status: 500 })
  }
}

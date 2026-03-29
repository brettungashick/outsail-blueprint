import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { createId } from '@paralleldrive/cuid2'
import vendorData from '../../../../../public/vendor-seed-data.json'

export const dynamic = 'force-dynamic'

interface VendorSeedEntry {
  product_name: string
  vendor_company?: string
  website?: string
  can_be_primary: boolean
  suggested_categories: string[]
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

  const seedData = vendorData as VendorSeedEntry[]

  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const entry of seedData) {
    try {
      // Check if a vendor with this product name already exists
      const existing = await db
        .select({ id: vendors.id })
        .from(vendors)
        .all()

      const alreadyExists = existing.some(
        (v) => v.id // just ensure rows exist — we use product_name for idempotency below
      )
      void alreadyExists

      // Use INSERT OR IGNORE semantics via Drizzle: try insert, catch unique violation
      // Since we don't have a unique constraint on product_name, check manually
      const existingByName = await db
        .select({ id: vendors.id })
        .from(vendors)
        .all()

      const nameExists = existingByName.some(() => false) // placeholder — handled below
      void nameExists

      // Re-fetch specifically by product_name match
      const allVendors = await db.select({ id: vendors.id, product_name: vendors.product_name }).from(vendors).all()
      const exists = allVendors.some((v) => v.product_name === entry.product_name)

      if (exists) {
        skipped++
        continue
      }

      await db.insert(vendors).values({
        id: createId(),
        product_name: entry.product_name,
        vendor_company: entry.vendor_company ?? null,
        website: entry.website ?? null,
        can_be_primary: entry.can_be_primary,
        suggested_categories: JSON.stringify(entry.suggested_categories),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })

      inserted++
    } catch (err) {
      errors.push(`${entry.product_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    total: seedData.length,
    inserted,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  })
}

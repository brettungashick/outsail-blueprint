import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'
import { VendorsClientPage } from './_vendors-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Vendor Management',
}

export default async function VendorsSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') redirect('/dashboard')

  let allVendors: Array<{
    id: string
    product_name: string
    vendor_company: string | null
    website: string | null
    logo_url: string | null
    primary_color: string | null
    can_be_primary: boolean | null
    suggested_categories: string | null
    is_active: boolean | null
  }> = []

  try {
    allVendors = await db
      .select({
        id: vendors.id,
        product_name: vendors.product_name,
        vendor_company: vendors.vendor_company,
        website: vendors.website,
        logo_url: vendors.logo_url,
        primary_color: vendors.primary_color,
        can_be_primary: vendors.can_be_primary,
        suggested_categories: vendors.suggested_categories,
        is_active: vendors.is_active,
      })
      .from(vendors)
      .all()
  } catch {
    // Table may not exist yet — show empty state with seed prompt
  }

  return <VendorsClientPage initialVendors={allVendors} />
}

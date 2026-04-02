import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') return null
  return session
}

export async function GET() {
  try {
    const logoRow = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'logo'))
      .get()
    return NextResponse.json({ logo: logoRow?.value ?? null })
  } catch {
    return NextResponse.json({ logo: null })
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await request.json() as { logo?: string | null }

  try {
    if (body.logo === null || body.logo === '') {
      // Delete
      await db.delete(appSettings).where(eq(appSettings.key, 'logo'))
    } else if (body.logo) {
      // Upsert — SQLite doesn't support ON CONFLICT DO UPDATE via Drizzle easily,
      // so delete + insert
      await db.delete(appSettings).where(eq(appSettings.key, 'logo'))
      await db.insert(appSettings).values({
        key: 'logo',
        value: body.logo,
        updated_at: new Date(),
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/app-settings] PUT error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dbUrl =
    process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken =
    process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!dbUrl) {
    return NextResponse.json({ error: 'Database URL not configured' }, { status: 500 })
  }

  const httpUrl = dbUrl.replace(/^libsql:\/\//, 'https://')

  const pipelineBody = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql: `CREATE TABLE IF NOT EXISTS vendors (
            id TEXT PRIMARY KEY NOT NULL,
            product_name TEXT NOT NULL,
            vendor_company TEXT,
            website TEXT,
            logo_url TEXT,
            primary_color TEXT,
            can_be_primary INTEGER DEFAULT 0,
            suggested_categories TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER,
            updated_at INTEGER
          )`,
        },
      },
      { type: 'close' },
    ],
  }

  try {
    const response = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipelineBody),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[create-vendors-table] Turso error:', response.status, text)
      return NextResponse.json(
        { error: `Database error: ${response.status}` },
        { status: 500 }
      )
    }

    const data = (await response.json()) as { results: Array<{ type: string; error?: { message: string } }> }
    const result = data.results[0]

    if (result?.type === 'error') {
      return NextResponse.json(
        { error: result.error?.message ?? 'Unknown error' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, message: 'vendors table created (or already exists)' })
  } catch (err) {
    console.error('[create-vendors-table] Failed:', err)
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 })
  }
}

// Support both GET (browser-friendly) and POST
export { handler as GET, handler as POST }

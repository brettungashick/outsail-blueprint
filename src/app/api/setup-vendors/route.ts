import { NextRequest, NextResponse } from 'next/server'
import vendorData from '../../../../public/vendor-seed-data.json'

export const dynamic = 'force-dynamic'

const SETUP_SECRET = 'outsail-init-2026'

interface VendorEntry {
  product_name: string
  vendor_company?: string
  website?: string
  can_be_primary: boolean
  suggested_categories: string[]
}

interface PipelineResult {
  type: string
  error?: { message: string }
  response?: {
    result?: {
      rows?: unknown[][]
    }
  }
}

// Generate a simple random ID (cuid2 not available in this pure-fetch context)
function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  if (searchParams.get('secret') !== SETUP_SECRET) {
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

  async function pipeline(requests: unknown[]): Promise<PipelineResult[]> {
    const res = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: [...requests, { type: 'close' }] }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Turso pipeline error ${res.status}: ${text}`)
    }
    const data = (await res.json()) as { results: PipelineResult[] }
    return data.results
  }

  // ── Step 1: Create vendors table if it doesn't exist ─────────────────────
  try {
    await pipeline([
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
    ])
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to create vendors table: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  // ── Step 2: Fetch existing product_names to skip duplicates ───────────────
  let existingNames = new Set<string>()
  try {
    const results = await pipeline([
      { type: 'execute', stmt: { sql: 'SELECT product_name FROM vendors' } },
    ])
    const rows = results[0]?.response?.result?.rows ?? []
    existingNames = new Set((rows as string[][]).map((r) => r[0]))
  } catch {
    // Table might be empty — treat as no existing rows
  }

  // ── Step 3: Insert each vendor not already present ────────────────────────
  const seed = vendorData as VendorEntry[]
  const now = Math.floor(Date.now() / 1000)

  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  for (const entry of seed) {
    if (existingNames.has(entry.product_name)) {
      skipped++
      continue
    }

    try {
      const results = await pipeline([
        {
          type: 'execute',
          stmt: {
            sql: `INSERT INTO vendors (id, product_name, vendor_company, website, can_be_primary, suggested_categories, is_active, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            args: [
              { type: 'text', value: makeId() },
              { type: 'text', value: entry.product_name },
              entry.vendor_company
                ? { type: 'text', value: entry.vendor_company }
                : { type: 'null' },
              entry.website
                ? { type: 'text', value: entry.website }
                : { type: 'null' },
              { type: 'integer', value: entry.can_be_primary ? '1' : '0' },
              { type: 'text', value: JSON.stringify(entry.suggested_categories) },
              { type: 'integer', value: String(now) },
              { type: 'integer', value: String(now) },
            ],
          },
        },
      ])

      if (results[0]?.type === 'error') {
        errors.push(`${entry.product_name}: ${results[0].error?.message ?? 'unknown'}`)
      } else {
        inserted++
        existingNames.add(entry.product_name)
      }
    } catch (err) {
      errors.push(`${entry.product_name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    total: seed.length,
    inserted,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  })
}

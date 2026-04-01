import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_SECRET = 'outsail-init-2026'

interface PipelineResult {
  type: string
  error?: { message: string }
  response?: { result?: { rows?: unknown[][] } }
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

  const report: Record<string, unknown> = {}

  // ── 1. Create sessions table ──────────────────────────────────────────────
  try {
    await pipeline([
      {
        type: 'execute',
        stmt: {
          sql: `CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            session_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            participant_name TEXT,
            participant_role TEXT,
            participant_email TEXT,
            focus_areas TEXT,
            transcript_raw TEXT,
            processing_status TEXT,
            created_by TEXT,
            created_at INTEGER,
            updated_at INTEGER
          )`,
        },
      },
    ])
    report.sessions_table = 'ok'
  } catch (err) {
    report.sessions_table = `error: ${err instanceof Error ? err.message : String(err)}`
  }

  // ── 2. Create chat_messages table ─────────────────────────────────────────
  try {
    await pipeline([
      {
        type: 'execute',
        stmt: {
          sql: `CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY NOT NULL,
            session_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            extractions TEXT,
            created_at INTEGER
          )`,
        },
      },
    ])
    report.chat_messages_table = 'ok'
  } catch (err) {
    report.chat_messages_table = `error: ${err instanceof Error ? err.message : String(err)}`
  }

  // ── 3. Add new Phase B/D columns to projects table ────────────────────────
  const newColumns = [
    'ALTER TABLE projects ADD COLUMN discovery_summary TEXT',
    'ALTER TABLE projects ADD COLUMN recommended_sections TEXT',
    'ALTER TABLE projects ADD COLUMN client_edits TEXT',
    'ALTER TABLE projects ADD COLUMN summary_approved_at INTEGER',
    'ALTER TABLE projects ADD COLUMN generated_at INTEGER',
    'ALTER TABLE projects ADD COLUMN generation_count INTEGER DEFAULT 0',
    'ALTER TABLE projects ADD COLUMN generation_metadata TEXT',
    'ALTER TABLE projects ADD COLUMN self_service_enabled INTEGER DEFAULT 0',
  ]

  const columnResults: Record<string, string> = {}
  for (const sql of newColumns) {
    const colName = sql.match(/ADD COLUMN (\w+)/)?.[1] ?? sql
    try {
      const results = await pipeline([{ type: 'execute', stmt: { sql } }])
      if (results[0]?.type === 'error') {
        // Column already exists — not a real error
        const msg = results[0].error?.message ?? ''
        columnResults[colName] = msg.includes('duplicate') || msg.includes('already') ? 'already_exists' : `error: ${msg}`
      } else {
        columnResults[colName] = 'added'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      columnResults[colName] = msg.includes('duplicate') || msg.includes('already') ? 'already_exists' : `error: ${msg}`
    }
  }
  report.project_columns = columnResults

  return NextResponse.json({ ok: true, ...report })
}

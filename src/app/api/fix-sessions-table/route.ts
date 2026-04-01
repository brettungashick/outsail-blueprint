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

  async function runStatement(sql: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${httpUrl}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql } },
          { type: 'close' },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${text}` }
    }

    const data = (await res.json()) as { results: PipelineResult[] }
    const result = data.results[0]

    if (result?.type === 'error') {
      return { ok: false, error: result.error?.message ?? 'Unknown error' }
    }

    return { ok: true }
  }

  const report: Record<string, string> = {}

  // ── sessions table ────────────────────────────────────────────────────────

  const sessionsColumns: Array<{ name: string; sql: string }> = [
    { name: 'sessions.status',             sql: `ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'active'` },
    { name: 'sessions.participant_name',   sql: `ALTER TABLE sessions ADD COLUMN participant_name TEXT` },
    { name: 'sessions.participant_role',   sql: `ALTER TABLE sessions ADD COLUMN participant_role TEXT` },
    { name: 'sessions.participant_email',  sql: `ALTER TABLE sessions ADD COLUMN participant_email TEXT` },
    { name: 'sessions.focus_areas',        sql: `ALTER TABLE sessions ADD COLUMN focus_areas TEXT` },
    { name: 'sessions.transcript_raw',     sql: `ALTER TABLE sessions ADD COLUMN transcript_raw TEXT` },
    { name: 'sessions.processing_status',  sql: `ALTER TABLE sessions ADD COLUMN processing_status TEXT` },
    { name: 'sessions.created_by',         sql: `ALTER TABLE sessions ADD COLUMN created_by TEXT` },
    { name: 'sessions.updated_at',         sql: `ALTER TABLE sessions ADD COLUMN updated_at INTEGER` },
  ]

  for (const col of sessionsColumns) {
    const result = await runStatement(col.sql)
    if (result.ok) {
      report[col.name] = 'added'
    } else if (result.error?.includes('duplicate column') || result.error?.includes('already exists')) {
      report[col.name] = 'already_exists'
    } else {
      report[col.name] = `error: ${result.error}`
    }
  }

  // ── chat_messages table ───────────────────────────────────────────────────

  const messagesColumns: Array<{ name: string; sql: string }> = [
    { name: 'chat_messages.session_id',  sql: `ALTER TABLE chat_messages ADD COLUMN session_id TEXT NOT NULL DEFAULT ''` },
    { name: 'chat_messages.project_id',  sql: `ALTER TABLE chat_messages ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
    { name: 'chat_messages.role',        sql: `ALTER TABLE chat_messages ADD COLUMN role TEXT NOT NULL DEFAULT ''` },
    { name: 'chat_messages.content',     sql: `ALTER TABLE chat_messages ADD COLUMN content TEXT NOT NULL DEFAULT ''` },
    { name: 'chat_messages.extractions', sql: `ALTER TABLE chat_messages ADD COLUMN extractions TEXT` },
    { name: 'chat_messages.created_at',  sql: `ALTER TABLE chat_messages ADD COLUMN created_at INTEGER` },
  ]

  for (const col of messagesColumns) {
    const result = await runStatement(col.sql)
    if (result.ok) {
      report[col.name] = 'added'
    } else if (result.error?.includes('duplicate column') || result.error?.includes('already exists')) {
      report[col.name] = 'already_exists'
    } else {
      report[col.name] = `error: ${result.error}`
    }
  }

  return NextResponse.json({ ok: true, report })
}

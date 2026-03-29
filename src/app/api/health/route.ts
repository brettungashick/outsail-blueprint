import { NextResponse } from 'next/server'

// Force dynamic rendering so the health check runs at request time, not build time
export const dynamic = 'force-dynamic'

const TABLES = [
  'organizations',
  'users',
  'projects',
  'project_members',
  'sessions',
  'tech_stack_systems',
  'integrations',
  'blueprint_sections',
  'requirements',
  'processes',
  'decisions',
  'open_questions',
  'chat_messages',
  'chat_contexts',
  'generated_outputs',
] as const

type TableName = (typeof TABLES)[number]

interface PipelineResult {
  type: string
  error?: { message: string }
}

export async function GET() {
  const dbUrl =
    process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken =
    process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  const timestamp = new Date().toISOString()

  if (!dbUrl) {
    return NextResponse.json(
      {
        status: 'degraded',
        database: {
          connected: false,
          tables: {},
          write_test: 'failed',
        },
        timestamp,
        error: 'Database URL not configured',
      },
      { status: 200 }
    )
  }

  // Convert libsql:// to https:// for the Turso HTTP pipeline API
  const httpUrl = dbUrl.replace(/^libsql:\/\//, 'https://')

  // Build pipeline: SELECT count(*) for each table + INSERT + DELETE for write test
  const selectStatements = TABLES.map((table) => ({
    type: 'execute',
    stmt: { sql: `SELECT count(*) FROM ${table}` },
  }))

  const writeInsertStatement = {
    type: 'execute',
    stmt: {
      sql: "INSERT INTO organizations (id, name) VALUES ('_health_test', '_health_check')",
    },
  }

  const writeDeleteStatement = {
    type: 'execute',
    stmt: {
      sql: "DELETE FROM organizations WHERE id = '_health_test'",
    },
  }

  const pipelineBody = {
    requests: [
      ...selectStatements,
      writeInsertStatement,
      writeDeleteStatement,
      { type: 'close' },
    ],
  }

  let pipelineResults: PipelineResult[]

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
      console.error('[health] Turso pipeline error:', response.status, text)
      return NextResponse.json(
        {
          status: 'degraded',
          database: {
            connected: false,
            tables: {},
            write_test: 'failed',
          },
          timestamp,
          error: `Turso pipeline returned ${response.status}`,
        },
        { status: 200 }
      )
    }

    const data = (await response.json()) as { results: PipelineResult[] }
    pipelineResults = data.results
  } catch (err) {
    console.error('[health] Failed to reach Turso:', err)
    return NextResponse.json(
      {
        status: 'degraded',
        database: {
          connected: false,
          tables: {},
          write_test: 'failed',
        },
        timestamp,
        error: 'Failed to reach database',
      },
      { status: 200 }
    )
  }

  // Map SELECT results to table statuses (indices 0..14 match TABLES order)
  const tableStatuses: Record<string, 'ok' | 'failed'> = {}
  TABLES.forEach((table, i) => {
    const result = pipelineResults[i]
    tableStatuses[table] =
      result && result.type !== 'error' ? 'ok' : 'failed'
  })

  // Write test results are at indices TABLES.length and TABLES.length+1
  const insertResult = pipelineResults[TABLES.length]
  const deleteResult = pipelineResults[TABLES.length + 1]
  const writeTest: 'ok' | 'failed' =
    insertResult?.type !== 'error' && deleteResult?.type !== 'error'
      ? 'ok'
      : 'failed'

  const allTablesOk = Object.values(tableStatuses).every((s) => s === 'ok')
  const overallStatus: 'ok' | 'degraded' =
    allTablesOk && writeTest === 'ok' ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status: overallStatus,
      database: {
        connected: true,
        tables: tableStatuses as Record<TableName, 'ok' | 'failed'>,
        write_test: writeTest,
      },
      timestamp,
    },
    { status: 200 }
  )
}

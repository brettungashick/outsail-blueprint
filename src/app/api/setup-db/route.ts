import { NextRequest, NextResponse } from 'next/server'

const SETUP_SECRET = 'outsail-init-2026'

// Tables in dependency order — referenced tables must exist before referencing ones.
const TABLES: Array<{ name: string; sql: string }> = [
  {
    name: 'organizations',
    sql: 'CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'users',
    sql: 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, role TEXT NOT NULL DEFAULT \'advisor\', organization_id TEXT REFERENCES organizations(id), created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'projects',
    sql: 'CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id), name TEXT NOT NULL, client_company_name TEXT NOT NULL, client_contact_email TEXT NOT NULL, headcount INTEGER, tier TEXT, status TEXT NOT NULL DEFAULT \'setup\', scope_notes TEXT, readiness_level TEXT, created_by TEXT REFERENCES users(id), created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'project_members',
    sql: 'CREATE TABLE IF NOT EXISTS project_members (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, invited_at INTEGER, joined_at INTEGER, created_at INTEGER)',
  },
  {
    name: 'sessions',
    sql: 'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), project_id TEXT REFERENCES projects(id), session_type TEXT NOT NULL, transcript_raw TEXT, processing_status TEXT, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'tech_stack_systems',
    sql: 'CREATE TABLE IF NOT EXISTS tech_stack_systems (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), system_name TEXT NOT NULL, vendor TEXT, system_type TEXT, is_primary INTEGER DEFAULT 0, modules_used TEXT, experience_rating INTEGER, go_live_date TEXT, contract_end_date TEXT, notes TEXT, created_at INTEGER)',
  },
  {
    name: 'integrations',
    sql: 'CREATE TABLE IF NOT EXISTS integrations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), source_system_id TEXT NOT NULL REFERENCES tech_stack_systems(id), target_system_id TEXT NOT NULL REFERENCES tech_stack_systems(id), integration_quality TEXT NOT NULL, data_types TEXT, notes TEXT, created_at INTEGER)',
  },
  {
    name: 'blueprint_sections',
    sql: 'CREATE TABLE IF NOT EXISTS blueprint_sections (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), section_name TEXT NOT NULL, section_key TEXT NOT NULL, depth TEXT NOT NULL DEFAULT \'standard\', status TEXT NOT NULL DEFAULT \'not_started\', completeness_score INTEGER DEFAULT 0, ai_narrative_current TEXT, ai_narrative_future TEXT, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'requirements',
    sql: 'CREATE TABLE IF NOT EXISTS requirements (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), section_id TEXT NOT NULL REFERENCES blueprint_sections(id), module TEXT NOT NULL, sub_process TEXT, actors TEXT, trigger TEXT, current_state TEXT, future_requirement TEXT NOT NULL, exceptions TEXT, integration_dependencies TEXT, reporting_needs TEXT, approval_rules TEXT, geography_entity TEXT, source TEXT, criticality TEXT, business_impact TEXT, frequency TEXT, user_population TEXT, compliance_regulatory TEXT, implementation_complexity TEXT, differentiator INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'processes',
    sql: 'CREATE TABLE IF NOT EXISTS processes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), section_id TEXT NOT NULL REFERENCES blueprint_sections(id), process_name TEXT NOT NULL, trigger TEXT, actors TEXT, steps TEXT, frequency TEXT, volume TEXT, current_systems TEXT, pain_points TEXT, desired_outcome TEXT, integration_touchpoints TEXT, data_inputs TEXT, data_outputs TEXT, approval_chain TEXT, exceptions_workarounds TEXT, source TEXT, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'decisions',
    sql: 'CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), section_id TEXT REFERENCES blueprint_sections(id), decision_text TEXT NOT NULL, decision_date TEXT, decision_makers TEXT, rationale TEXT, alternatives_considered TEXT, impact TEXT, source TEXT, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'open_questions',
    sql: 'CREATE TABLE IF NOT EXISTS open_questions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), section_id TEXT REFERENCES blueprint_sections(id), question_text TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'open\', assigned_to TEXT REFERENCES users(id), answer TEXT, source TEXT, created_at INTEGER, updated_at INTEGER)',
  },
  {
    name: 'chat_messages',
    sql: 'CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), role TEXT NOT NULL, content TEXT NOT NULL, extractions TEXT, extraction_status TEXT NOT NULL DEFAULT \'none\', created_by TEXT REFERENCES users(id), created_at INTEGER)',
  },
  {
    name: 'chat_contexts',
    sql: 'CREATE TABLE IF NOT EXISTS chat_contexts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE REFERENCES projects(id), advisor_notes TEXT, sections_covered TEXT, current_topic TEXT, suggested_next_topics TEXT, updated_at INTEGER)',
  },
  {
    name: 'generated_outputs',
    sql: 'CREATE TABLE IF NOT EXISTS generated_outputs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), output_type TEXT NOT NULL, format TEXT, status TEXT NOT NULL DEFAULT \'generating\', content TEXT, file_url TEXT, version INTEGER DEFAULT 1, generated_by TEXT REFERENCES users(id), created_at INTEGER)',
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  if (searchParams.get('secret') !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dbUrl =
    process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken =
    process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!dbUrl) {
    return NextResponse.json(
      { error: 'Database URL not configured' },
      { status: 500 }
    )
  }

  // Convert libsql:// to https:// for the Turso HTTP pipeline API.
  // The pipeline endpoint accepts an array of statements and executes them
  // in a single request, returning per-statement results.
  const httpUrl = dbUrl.replace(/^libsql:\/\//, 'https://')

  const pipelineBody = {
    requests: [
      ...TABLES.map(({ sql }) => ({
        type: 'execute',
        stmt: { sql },
      })),
      { type: 'close' },
    ],
  }

  let pipelineResults: Array<{ type: string; error?: { message: string } }>

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
      return NextResponse.json(
        { error: `Turso pipeline returned ${response.status}`, detail: text },
        { status: 502 }
      )
    }

    const data = await response.json() as { results: typeof pipelineResults }
    pipelineResults = data.results
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to reach Turso', detail: String(err) },
      { status: 502 }
    )
  }

  // Map each result back to its table name (results array matches TABLES order).
  const results = TABLES.map(({ name }, i) => {
    const result = pipelineResults[i]
    if (result?.type === 'error') {
      return { table: name, status: 'error' as const, error: result.error?.message }
    }
    return { table: name, status: 'ok' as const }
  })

  const ok = results.filter((r) => r.status === 'ok').map((r) => r.table)
  const errors = results.filter((r) => r.status === 'error')

  return NextResponse.json({
    success: errors.length === 0,
    tables_processed: TABLES.length,
    tables_ok: ok,
    errors,
  })
}

/**
 * src/lib/db/migrations.ts
 *
 * Single source of truth for the Turso/libSQL database schema.
 * Every statement is idempotent — safe to run on every deploy.
 *
 * Strategy:
 *   1. CREATE TABLE IF NOT EXISTS — builds table with all columns on fresh DBs
 *   2. ALTER TABLE ADD COLUMN — adds any column that was missing on existing DBs
 *      (duplicate-column errors are treated as success, not failures)
 *   3. Seed vendors — inserts missing vendor rows (skips existing ones)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vendorData = require('../../../public/vendor-seed-data.json') as Array<{
  product_name: string
  vendor_company?: string
  website?: string
  can_be_primary: boolean
  suggested_categories: string[]
}>

// ── Turso HTTP pipeline ───────────────────────────────────────────────────────

interface PipelineResult {
  type: string
  error?: { message: string }
  response?: { result?: { rows?: unknown[][] } }
}

function getTursoConfig(): { httpUrl: string; authToken: string } {
  const dbUrl =
    process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
  if (!dbUrl) throw new Error('TURSO_DATABASE_URL is not configured')
  const authToken =
    process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || ''
  return {
    httpUrl: dbUrl.replace(/^libsql:\/\//, 'https://'),
    authToken,
  }
}

async function execSQL(
  httpUrl: string,
  authToken: string,
  sql: string,
  args?: Array<{ type: string; value: string } | { type: 'null' }>
): Promise<PipelineResult> {
  const stmt: Record<string, unknown> = { sql }
  if (args) stmt.args = args

  const res = await fetch(`${httpUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt }, { type: 'close' }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Turso HTTP ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { results: PipelineResult[] }
  return data.results[0]
}

function isDuplicateColumn(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('duplicate column') || lower.includes('already exists')
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// ── Report types ──────────────────────────────────────────────────────────────

export interface MigrationReport {
  tables: Record<string, 'ok' | string>
  columns: Record<string, 'added' | 'already_exists' | string>
  vendors: { inserted: number; skipped: number; errors: string[] }
  errors: string[]
}

// ── CREATE TABLE statements (dependency order) ────────────────────────────────

const CREATE_TABLES: Array<{ name: string; sql: string }> = [
  {
    name: 'organizations',
    sql: `CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'advisor',
      organization_id TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'projects',
    sql: `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT,
      name TEXT NOT NULL,
      client_company_name TEXT NOT NULL,
      client_contact_email TEXT NOT NULL,
      headcount INTEGER,
      tier TEXT,
      status TEXT NOT NULL DEFAULT 'intake',
      scope_notes TEXT,
      readiness_level TEXT,
      discovery_summary TEXT,
      recommended_sections TEXT,
      client_edits TEXT,
      summary_approved_at INTEGER,
      generated_at INTEGER,
      generation_count INTEGER DEFAULT 0,
      generation_metadata TEXT,
      self_service_enabled INTEGER DEFAULT 0,
      created_by TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'project_members',
    sql: `CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      invited_at INTEGER,
      joined_at INTEGER,
      created_at INTEGER
    )`,
  },
  {
    name: 'sessions',
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
  {
    name: 'chat_messages',
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
  {
    name: 'tech_stack_systems',
    sql: `CREATE TABLE IF NOT EXISTS tech_stack_systems (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      system_name TEXT NOT NULL,
      vendor TEXT,
      system_type TEXT,
      is_primary INTEGER DEFAULT 0,
      modules_used TEXT,
      experience_rating INTEGER,
      go_live_date TEXT,
      contract_end_date TEXT,
      notes TEXT,
      created_at INTEGER
    )`,
  },
  {
    name: 'integrations',
    sql: `CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      source_system_id TEXT NOT NULL,
      target_system_id TEXT NOT NULL,
      integration_quality TEXT NOT NULL,
      data_types TEXT,
      notes TEXT,
      created_at INTEGER
    )`,
  },
  {
    name: 'blueprint_sections',
    sql: `CREATE TABLE IF NOT EXISTS blueprint_sections (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      section_name TEXT NOT NULL,
      section_key TEXT NOT NULL,
      depth TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'not_started',
      completeness_score INTEGER DEFAULT 0,
      ai_narrative_current TEXT,
      ai_narrative_future TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'requirements',
    sql: `CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      module TEXT NOT NULL,
      sub_process TEXT,
      actors TEXT,
      trigger TEXT,
      current_state TEXT,
      future_requirement TEXT NOT NULL DEFAULT '',
      exceptions TEXT,
      integration_dependencies TEXT,
      reporting_needs TEXT,
      approval_rules TEXT,
      geography_entity TEXT,
      source TEXT,
      criticality TEXT,
      business_impact TEXT,
      frequency TEXT,
      user_population TEXT,
      compliance_regulatory TEXT,
      implementation_complexity TEXT,
      differentiator INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'processes',
    sql: `CREATE TABLE IF NOT EXISTS processes (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      process_name TEXT NOT NULL,
      trigger TEXT,
      actors TEXT,
      steps TEXT,
      frequency TEXT,
      volume TEXT,
      current_systems TEXT,
      pain_points TEXT,
      desired_outcome TEXT,
      integration_touchpoints TEXT,
      data_inputs TEXT,
      data_outputs TEXT,
      approval_chain TEXT,
      exceptions_workarounds TEXT,
      source TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'decisions',
    sql: `CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      section_id TEXT,
      decision_text TEXT NOT NULL DEFAULT '',
      decision_date TEXT,
      decision_makers TEXT,
      rationale TEXT,
      alternatives_considered TEXT,
      impact TEXT,
      source TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'open_questions',
    sql: `CREATE TABLE IF NOT EXISTS open_questions (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      section_id TEXT,
      question_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      answer TEXT,
      source TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )`,
  },
  {
    name: 'chat_contexts',
    sql: `CREATE TABLE IF NOT EXISTS chat_contexts (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL UNIQUE,
      advisor_notes TEXT,
      sections_covered TEXT,
      current_topic TEXT,
      suggested_next_topics TEXT,
      updated_at INTEGER
    )`,
  },
  {
    name: 'generated_outputs',
    sql: `CREATE TABLE IF NOT EXISTS generated_outputs (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      output_type TEXT NOT NULL,
      format TEXT,
      status TEXT NOT NULL DEFAULT 'generating',
      content TEXT,
      file_url TEXT,
      version INTEGER DEFAULT 1,
      generated_by TEXT,
      created_at INTEGER
    )`,
  },
  {
    name: 'vendors',
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
]

// ── ALTER TABLE statements (covers all non-PK columns for all tables) ─────────
//
// This ensures that tables created before a column was added to the schema
// get the missing column. Duplicate-column errors are treated as success.
//
// Rules for ALTER TABLE in SQLite:
//   - Cannot add PRIMARY KEY columns
//   - Cannot add UNIQUE columns
//   - NOT NULL columns require a DEFAULT value (for existing rows)

const ALTER_COLUMNS: Array<{ col: string; sql: string }> = [
  // organizations
  { col: 'organizations.name',              sql: `ALTER TABLE organizations ADD COLUMN name TEXT NOT NULL DEFAULT ''` },
  { col: 'organizations.logo_url',          sql: `ALTER TABLE organizations ADD COLUMN logo_url TEXT` },
  { col: 'organizations.created_at',        sql: `ALTER TABLE organizations ADD COLUMN created_at INTEGER` },
  { col: 'organizations.updated_at',        sql: `ALTER TABLE organizations ADD COLUMN updated_at INTEGER` },

  // users
  { col: 'users.name',                      sql: `ALTER TABLE users ADD COLUMN name TEXT` },
  { col: 'users.role',                      sql: `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'advisor'` },
  { col: 'users.organization_id',           sql: `ALTER TABLE users ADD COLUMN organization_id TEXT` },
  { col: 'users.password_hash',             sql: `ALTER TABLE users ADD COLUMN password_hash TEXT` },
  { col: 'users.must_change_password',      sql: `ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0` },
  { col: 'users.created_at',               sql: `ALTER TABLE users ADD COLUMN created_at INTEGER` },
  { col: 'users.updated_at',               sql: `ALTER TABLE users ADD COLUMN updated_at INTEGER` },

  // projects — core columns
  { col: 'projects.organization_id',        sql: `ALTER TABLE projects ADD COLUMN organization_id TEXT` },
  { col: 'projects.name',                   sql: `ALTER TABLE projects ADD COLUMN name TEXT NOT NULL DEFAULT ''` },
  { col: 'projects.client_company_name',    sql: `ALTER TABLE projects ADD COLUMN client_company_name TEXT NOT NULL DEFAULT ''` },
  { col: 'projects.client_contact_email',   sql: `ALTER TABLE projects ADD COLUMN client_contact_email TEXT NOT NULL DEFAULT ''` },
  { col: 'projects.headcount',              sql: `ALTER TABLE projects ADD COLUMN headcount INTEGER` },
  { col: 'projects.tier',                   sql: `ALTER TABLE projects ADD COLUMN tier TEXT` },
  { col: 'projects.status',                 sql: `ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'intake'` },
  { col: 'projects.scope_notes',            sql: `ALTER TABLE projects ADD COLUMN scope_notes TEXT` },
  { col: 'projects.readiness_level',        sql: `ALTER TABLE projects ADD COLUMN readiness_level TEXT` },
  // projects — Phase B discovery columns
  { col: 'projects.discovery_summary',      sql: `ALTER TABLE projects ADD COLUMN discovery_summary TEXT` },
  { col: 'projects.recommended_sections',   sql: `ALTER TABLE projects ADD COLUMN recommended_sections TEXT` },
  { col: 'projects.client_edits',           sql: `ALTER TABLE projects ADD COLUMN client_edits TEXT` },
  { col: 'projects.summary_approved_at',    sql: `ALTER TABLE projects ADD COLUMN summary_approved_at INTEGER` },
  // projects — Phase D generation columns
  { col: 'projects.generated_at',           sql: `ALTER TABLE projects ADD COLUMN generated_at INTEGER` },
  { col: 'projects.generation_count',       sql: `ALTER TABLE projects ADD COLUMN generation_count INTEGER DEFAULT 0` },
  { col: 'projects.generation_metadata',    sql: `ALTER TABLE projects ADD COLUMN generation_metadata TEXT` },
  { col: 'projects.self_service_enabled',   sql: `ALTER TABLE projects ADD COLUMN self_service_enabled INTEGER DEFAULT 0` },
  { col: 'projects.created_by',             sql: `ALTER TABLE projects ADD COLUMN created_by TEXT` },
  { col: 'projects.created_at',             sql: `ALTER TABLE projects ADD COLUMN created_at INTEGER` },
  { col: 'projects.updated_at',             sql: `ALTER TABLE projects ADD COLUMN updated_at INTEGER` },

  // project_members
  { col: 'project_members.project_id',      sql: `ALTER TABLE project_members ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'project_members.user_id',         sql: `ALTER TABLE project_members ADD COLUMN user_id TEXT NOT NULL DEFAULT ''` },
  { col: 'project_members.role',            sql: `ALTER TABLE project_members ADD COLUMN role TEXT NOT NULL DEFAULT 'client'` },
  { col: 'project_members.invited_at',      sql: `ALTER TABLE project_members ADD COLUMN invited_at INTEGER` },
  { col: 'project_members.joined_at',       sql: `ALTER TABLE project_members ADD COLUMN joined_at INTEGER` },
  { col: 'project_members.created_at',      sql: `ALTER TABLE project_members ADD COLUMN created_at INTEGER` },

  // sessions
  { col: 'sessions.project_id',             sql: `ALTER TABLE sessions ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'sessions.session_type',           sql: `ALTER TABLE sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'discovery'` },
  { col: 'sessions.status',                 sql: `ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'active'` },
  { col: 'sessions.participant_name',       sql: `ALTER TABLE sessions ADD COLUMN participant_name TEXT` },
  { col: 'sessions.participant_role',       sql: `ALTER TABLE sessions ADD COLUMN participant_role TEXT` },
  { col: 'sessions.participant_email',      sql: `ALTER TABLE sessions ADD COLUMN participant_email TEXT` },
  { col: 'sessions.focus_areas',            sql: `ALTER TABLE sessions ADD COLUMN focus_areas TEXT` },
  { col: 'sessions.transcript_raw',         sql: `ALTER TABLE sessions ADD COLUMN transcript_raw TEXT` },
  { col: 'sessions.processing_status',      sql: `ALTER TABLE sessions ADD COLUMN processing_status TEXT` },
  { col: 'sessions.created_by',             sql: `ALTER TABLE sessions ADD COLUMN created_by TEXT` },
  { col: 'sessions.created_at',             sql: `ALTER TABLE sessions ADD COLUMN created_at INTEGER` },
  { col: 'sessions.updated_at',             sql: `ALTER TABLE sessions ADD COLUMN updated_at INTEGER` },

  // chat_messages
  { col: 'chat_messages.session_id',        sql: `ALTER TABLE chat_messages ADD COLUMN session_id TEXT NOT NULL DEFAULT ''` },
  { col: 'chat_messages.project_id',        sql: `ALTER TABLE chat_messages ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'chat_messages.role',              sql: `ALTER TABLE chat_messages ADD COLUMN role TEXT NOT NULL DEFAULT 'user'` },
  { col: 'chat_messages.content',           sql: `ALTER TABLE chat_messages ADD COLUMN content TEXT NOT NULL DEFAULT ''` },
  { col: 'chat_messages.extractions',       sql: `ALTER TABLE chat_messages ADD COLUMN extractions TEXT` },
  { col: 'chat_messages.created_at',        sql: `ALTER TABLE chat_messages ADD COLUMN created_at INTEGER` },

  // tech_stack_systems
  { col: 'tech_stack_systems.project_id',        sql: `ALTER TABLE tech_stack_systems ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'tech_stack_systems.system_name',        sql: `ALTER TABLE tech_stack_systems ADD COLUMN system_name TEXT NOT NULL DEFAULT ''` },
  { col: 'tech_stack_systems.vendor',             sql: `ALTER TABLE tech_stack_systems ADD COLUMN vendor TEXT` },
  { col: 'tech_stack_systems.system_type',        sql: `ALTER TABLE tech_stack_systems ADD COLUMN system_type TEXT` },
  { col: 'tech_stack_systems.is_primary',         sql: `ALTER TABLE tech_stack_systems ADD COLUMN is_primary INTEGER DEFAULT 0` },
  { col: 'tech_stack_systems.modules_used',       sql: `ALTER TABLE tech_stack_systems ADD COLUMN modules_used TEXT` },
  { col: 'tech_stack_systems.experience_rating',  sql: `ALTER TABLE tech_stack_systems ADD COLUMN experience_rating INTEGER` },
  { col: 'tech_stack_systems.go_live_date',       sql: `ALTER TABLE tech_stack_systems ADD COLUMN go_live_date TEXT` },
  { col: 'tech_stack_systems.contract_end_date',  sql: `ALTER TABLE tech_stack_systems ADD COLUMN contract_end_date TEXT` },
  { col: 'tech_stack_systems.notes',              sql: `ALTER TABLE tech_stack_systems ADD COLUMN notes TEXT` },
  { col: 'tech_stack_systems.created_at',         sql: `ALTER TABLE tech_stack_systems ADD COLUMN created_at INTEGER` },

  // integrations
  { col: 'integrations.project_id',          sql: `ALTER TABLE integrations ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'integrations.source_system_id',    sql: `ALTER TABLE integrations ADD COLUMN source_system_id TEXT NOT NULL DEFAULT ''` },
  { col: 'integrations.target_system_id',    sql: `ALTER TABLE integrations ADD COLUMN target_system_id TEXT NOT NULL DEFAULT ''` },
  { col: 'integrations.integration_quality', sql: `ALTER TABLE integrations ADD COLUMN integration_quality TEXT NOT NULL DEFAULT 'fully_manual'` },
  { col: 'integrations.data_types',          sql: `ALTER TABLE integrations ADD COLUMN data_types TEXT` },
  { col: 'integrations.notes',               sql: `ALTER TABLE integrations ADD COLUMN notes TEXT` },
  { col: 'integrations.created_at',          sql: `ALTER TABLE integrations ADD COLUMN created_at INTEGER` },

  // blueprint_sections
  { col: 'blueprint_sections.project_id',             sql: `ALTER TABLE blueprint_sections ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'blueprint_sections.section_name',           sql: `ALTER TABLE blueprint_sections ADD COLUMN section_name TEXT NOT NULL DEFAULT ''` },
  { col: 'blueprint_sections.section_key',            sql: `ALTER TABLE blueprint_sections ADD COLUMN section_key TEXT NOT NULL DEFAULT ''` },
  { col: 'blueprint_sections.depth',                  sql: `ALTER TABLE blueprint_sections ADD COLUMN depth TEXT NOT NULL DEFAULT 'standard'` },
  { col: 'blueprint_sections.status',                 sql: `ALTER TABLE blueprint_sections ADD COLUMN status TEXT NOT NULL DEFAULT 'not_started'` },
  { col: 'blueprint_sections.completeness_score',     sql: `ALTER TABLE blueprint_sections ADD COLUMN completeness_score INTEGER DEFAULT 0` },
  { col: 'blueprint_sections.ai_narrative_current',   sql: `ALTER TABLE blueprint_sections ADD COLUMN ai_narrative_current TEXT` },
  { col: 'blueprint_sections.ai_narrative_future',    sql: `ALTER TABLE blueprint_sections ADD COLUMN ai_narrative_future TEXT` },
  { col: 'blueprint_sections.created_at',             sql: `ALTER TABLE blueprint_sections ADD COLUMN created_at INTEGER` },
  { col: 'blueprint_sections.updated_at',             sql: `ALTER TABLE blueprint_sections ADD COLUMN updated_at INTEGER` },

  // requirements
  { col: 'requirements.project_id',                   sql: `ALTER TABLE requirements ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'requirements.section_id',                   sql: `ALTER TABLE requirements ADD COLUMN section_id TEXT NOT NULL DEFAULT ''` },
  { col: 'requirements.module',                        sql: `ALTER TABLE requirements ADD COLUMN module TEXT NOT NULL DEFAULT ''` },
  { col: 'requirements.sub_process',                  sql: `ALTER TABLE requirements ADD COLUMN sub_process TEXT` },
  { col: 'requirements.actors',                        sql: `ALTER TABLE requirements ADD COLUMN actors TEXT` },
  { col: 'requirements.trigger',                       sql: `ALTER TABLE requirements ADD COLUMN trigger TEXT` },
  { col: 'requirements.current_state',                sql: `ALTER TABLE requirements ADD COLUMN current_state TEXT` },
  { col: 'requirements.future_requirement',           sql: `ALTER TABLE requirements ADD COLUMN future_requirement TEXT NOT NULL DEFAULT ''` },
  { col: 'requirements.exceptions',                   sql: `ALTER TABLE requirements ADD COLUMN exceptions TEXT` },
  { col: 'requirements.integration_dependencies',     sql: `ALTER TABLE requirements ADD COLUMN integration_dependencies TEXT` },
  { col: 'requirements.reporting_needs',              sql: `ALTER TABLE requirements ADD COLUMN reporting_needs TEXT` },
  { col: 'requirements.approval_rules',               sql: `ALTER TABLE requirements ADD COLUMN approval_rules TEXT` },
  { col: 'requirements.geography_entity',             sql: `ALTER TABLE requirements ADD COLUMN geography_entity TEXT` },
  { col: 'requirements.source',                        sql: `ALTER TABLE requirements ADD COLUMN source TEXT` },
  { col: 'requirements.criticality',                  sql: `ALTER TABLE requirements ADD COLUMN criticality TEXT` },
  { col: 'requirements.business_impact',              sql: `ALTER TABLE requirements ADD COLUMN business_impact TEXT` },
  { col: 'requirements.frequency',                    sql: `ALTER TABLE requirements ADD COLUMN frequency TEXT` },
  { col: 'requirements.user_population',              sql: `ALTER TABLE requirements ADD COLUMN user_population TEXT` },
  { col: 'requirements.compliance_regulatory',        sql: `ALTER TABLE requirements ADD COLUMN compliance_regulatory TEXT` },
  { col: 'requirements.implementation_complexity',    sql: `ALTER TABLE requirements ADD COLUMN implementation_complexity TEXT` },
  { col: 'requirements.differentiator',               sql: `ALTER TABLE requirements ADD COLUMN differentiator INTEGER DEFAULT 0` },
  { col: 'requirements.created_at',                   sql: `ALTER TABLE requirements ADD COLUMN created_at INTEGER` },
  { col: 'requirements.updated_at',                   sql: `ALTER TABLE requirements ADD COLUMN updated_at INTEGER` },

  // processes
  { col: 'processes.project_id',              sql: `ALTER TABLE processes ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'processes.section_id',              sql: `ALTER TABLE processes ADD COLUMN section_id TEXT NOT NULL DEFAULT ''` },
  { col: 'processes.process_name',            sql: `ALTER TABLE processes ADD COLUMN process_name TEXT NOT NULL DEFAULT ''` },
  { col: 'processes.trigger',                 sql: `ALTER TABLE processes ADD COLUMN trigger TEXT` },
  { col: 'processes.actors',                  sql: `ALTER TABLE processes ADD COLUMN actors TEXT` },
  { col: 'processes.steps',                   sql: `ALTER TABLE processes ADD COLUMN steps TEXT` },
  { col: 'processes.frequency',               sql: `ALTER TABLE processes ADD COLUMN frequency TEXT` },
  { col: 'processes.volume',                  sql: `ALTER TABLE processes ADD COLUMN volume TEXT` },
  { col: 'processes.current_systems',         sql: `ALTER TABLE processes ADD COLUMN current_systems TEXT` },
  { col: 'processes.pain_points',             sql: `ALTER TABLE processes ADD COLUMN pain_points TEXT` },
  { col: 'processes.desired_outcome',         sql: `ALTER TABLE processes ADD COLUMN desired_outcome TEXT` },
  { col: 'processes.integration_touchpoints', sql: `ALTER TABLE processes ADD COLUMN integration_touchpoints TEXT` },
  { col: 'processes.data_inputs',             sql: `ALTER TABLE processes ADD COLUMN data_inputs TEXT` },
  { col: 'processes.data_outputs',            sql: `ALTER TABLE processes ADD COLUMN data_outputs TEXT` },
  { col: 'processes.approval_chain',          sql: `ALTER TABLE processes ADD COLUMN approval_chain TEXT` },
  { col: 'processes.exceptions_workarounds',  sql: `ALTER TABLE processes ADD COLUMN exceptions_workarounds TEXT` },
  { col: 'processes.source',                  sql: `ALTER TABLE processes ADD COLUMN source TEXT` },
  { col: 'processes.created_at',              sql: `ALTER TABLE processes ADD COLUMN created_at INTEGER` },
  { col: 'processes.updated_at',              sql: `ALTER TABLE processes ADD COLUMN updated_at INTEGER` },

  // decisions
  { col: 'decisions.project_id',                  sql: `ALTER TABLE decisions ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'decisions.section_id',                  sql: `ALTER TABLE decisions ADD COLUMN section_id TEXT` },
  { col: 'decisions.decision_text',               sql: `ALTER TABLE decisions ADD COLUMN decision_text TEXT NOT NULL DEFAULT ''` },
  { col: 'decisions.decision_date',               sql: `ALTER TABLE decisions ADD COLUMN decision_date TEXT` },
  { col: 'decisions.decision_makers',             sql: `ALTER TABLE decisions ADD COLUMN decision_makers TEXT` },
  { col: 'decisions.rationale',                   sql: `ALTER TABLE decisions ADD COLUMN rationale TEXT` },
  { col: 'decisions.alternatives_considered',     sql: `ALTER TABLE decisions ADD COLUMN alternatives_considered TEXT` },
  { col: 'decisions.impact',                      sql: `ALTER TABLE decisions ADD COLUMN impact TEXT` },
  { col: 'decisions.source',                      sql: `ALTER TABLE decisions ADD COLUMN source TEXT` },
  { col: 'decisions.created_at',                  sql: `ALTER TABLE decisions ADD COLUMN created_at INTEGER` },
  { col: 'decisions.updated_at',                  sql: `ALTER TABLE decisions ADD COLUMN updated_at INTEGER` },

  // open_questions
  { col: 'open_questions.project_id',    sql: `ALTER TABLE open_questions ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'open_questions.section_id',    sql: `ALTER TABLE open_questions ADD COLUMN section_id TEXT` },
  { col: 'open_questions.question_text', sql: `ALTER TABLE open_questions ADD COLUMN question_text TEXT NOT NULL DEFAULT ''` },
  { col: 'open_questions.status',        sql: `ALTER TABLE open_questions ADD COLUMN status TEXT NOT NULL DEFAULT 'open'` },
  { col: 'open_questions.assigned_to',   sql: `ALTER TABLE open_questions ADD COLUMN assigned_to TEXT` },
  { col: 'open_questions.answer',        sql: `ALTER TABLE open_questions ADD COLUMN answer TEXT` },
  { col: 'open_questions.source',        sql: `ALTER TABLE open_questions ADD COLUMN source TEXT` },
  { col: 'open_questions.created_at',    sql: `ALTER TABLE open_questions ADD COLUMN created_at INTEGER` },
  { col: 'open_questions.updated_at',    sql: `ALTER TABLE open_questions ADD COLUMN updated_at INTEGER` },

  // chat_contexts
  { col: 'chat_contexts.advisor_notes',           sql: `ALTER TABLE chat_contexts ADD COLUMN advisor_notes TEXT` },
  { col: 'chat_contexts.sections_covered',        sql: `ALTER TABLE chat_contexts ADD COLUMN sections_covered TEXT` },
  { col: 'chat_contexts.current_topic',           sql: `ALTER TABLE chat_contexts ADD COLUMN current_topic TEXT` },
  { col: 'chat_contexts.suggested_next_topics',   sql: `ALTER TABLE chat_contexts ADD COLUMN suggested_next_topics TEXT` },
  { col: 'chat_contexts.updated_at',              sql: `ALTER TABLE chat_contexts ADD COLUMN updated_at INTEGER` },

  // generated_outputs
  { col: 'generated_outputs.project_id',    sql: `ALTER TABLE generated_outputs ADD COLUMN project_id TEXT NOT NULL DEFAULT ''` },
  { col: 'generated_outputs.output_type',   sql: `ALTER TABLE generated_outputs ADD COLUMN output_type TEXT NOT NULL DEFAULT ''` },
  { col: 'generated_outputs.format',        sql: `ALTER TABLE generated_outputs ADD COLUMN format TEXT` },
  { col: 'generated_outputs.status',        sql: `ALTER TABLE generated_outputs ADD COLUMN status TEXT NOT NULL DEFAULT 'generating'` },
  { col: 'generated_outputs.content',       sql: `ALTER TABLE generated_outputs ADD COLUMN content TEXT` },
  { col: 'generated_outputs.file_url',      sql: `ALTER TABLE generated_outputs ADD COLUMN file_url TEXT` },
  { col: 'generated_outputs.version',       sql: `ALTER TABLE generated_outputs ADD COLUMN version INTEGER DEFAULT 1` },
  { col: 'generated_outputs.generated_by',  sql: `ALTER TABLE generated_outputs ADD COLUMN generated_by TEXT` },
  { col: 'generated_outputs.created_at',    sql: `ALTER TABLE generated_outputs ADD COLUMN created_at INTEGER` },

  // vendors
  { col: 'vendors.product_name',        sql: `ALTER TABLE vendors ADD COLUMN product_name TEXT NOT NULL DEFAULT ''` },
  { col: 'vendors.vendor_company',      sql: `ALTER TABLE vendors ADD COLUMN vendor_company TEXT` },
  { col: 'vendors.website',             sql: `ALTER TABLE vendors ADD COLUMN website TEXT` },
  { col: 'vendors.logo_url',            sql: `ALTER TABLE vendors ADD COLUMN logo_url TEXT` },
  { col: 'vendors.primary_color',       sql: `ALTER TABLE vendors ADD COLUMN primary_color TEXT` },
  { col: 'vendors.can_be_primary',      sql: `ALTER TABLE vendors ADD COLUMN can_be_primary INTEGER DEFAULT 0` },
  { col: 'vendors.suggested_categories',sql: `ALTER TABLE vendors ADD COLUMN suggested_categories TEXT` },
  { col: 'vendors.is_active',           sql: `ALTER TABLE vendors ADD COLUMN is_active INTEGER DEFAULT 1` },
  { col: 'vendors.created_at',          sql: `ALTER TABLE vendors ADD COLUMN created_at INTEGER` },
  { col: 'vendors.updated_at',          sql: `ALTER TABLE vendors ADD COLUMN updated_at INTEGER` },
]

// ── Main migration runner ─────────────────────────────────────────────────────

export async function runMigrations(): Promise<MigrationReport> {
  const { httpUrl, authToken } = getTursoConfig()

  const report: MigrationReport = {
    tables: {},
    columns: {},
    vendors: { inserted: 0, skipped: 0, errors: [] },
    errors: [],
  }

  // 1. Create all tables
  for (const { name, sql } of CREATE_TABLES) {
    try {
      const result = await execSQL(httpUrl, authToken, sql)
      if (result?.type === 'error') {
        const msg = result.error?.message ?? 'unknown'
        report.tables[name] = `error: ${msg}`
        report.errors.push(`CREATE TABLE ${name}: ${msg}`)
      } else {
        report.tables[name] = 'ok'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.tables[name] = `error: ${msg}`
      report.errors.push(`CREATE TABLE ${name}: ${msg}`)
    }
  }

  // 2. Add missing columns (ALTER TABLE — idempotent)
  for (const { col, sql } of ALTER_COLUMNS) {
    try {
      const result = await execSQL(httpUrl, authToken, sql)
      if (result?.type === 'error') {
        const msg = result.error?.message ?? 'unknown'
        report.columns[col] = isDuplicateColumn(msg) ? 'already_exists' : `error: ${msg}`
        if (!isDuplicateColumn(msg)) {
          report.errors.push(`ALTER COLUMN ${col}: ${msg}`)
        }
      } else {
        report.columns[col] = 'added'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.columns[col] = isDuplicateColumn(msg) ? 'already_exists' : `error: ${msg}`
      if (!isDuplicateColumn(msg)) {
        report.errors.push(`ALTER COLUMN ${col}: ${msg}`)
      }
    }
  }

  // 3. Seed vendors (idempotent — skips existing product_names)
  try {
    const existingResult = await execSQL(httpUrl, authToken, 'SELECT product_name FROM vendors')
    const rows = existingResult?.response?.result?.rows ?? []
    const existingNames = new Set((rows as string[][]).map((r) => r[0]))

    const now = Math.floor(Date.now() / 1000)

    for (const entry of vendorData) {
      if (existingNames.has(entry.product_name)) {
        report.vendors.skipped++
        continue
      }

      try {
        const insertResult = await execSQL(
          httpUrl,
          authToken,
          `INSERT INTO vendors (id, product_name, vendor_company, website, can_be_primary, suggested_categories, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
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
          ]
        )

        if (insertResult?.type === 'error') {
          report.vendors.errors.push(
            `${entry.product_name}: ${insertResult.error?.message ?? 'unknown'}`
          )
        } else {
          report.vendors.inserted++
          existingNames.add(entry.product_name)
        }
      } catch (err) {
        report.vendors.errors.push(
          `${entry.product_name}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    report.vendors.errors.push(`seed: ${msg}`)
    report.errors.push(`vendor seed: ${msg}`)
  }

  return report
}

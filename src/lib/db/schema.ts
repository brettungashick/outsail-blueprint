import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'

// ============================================================
// organizations
// ============================================================
export const organizations = sqliteTable('organizations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  logo_url: text('logo_url'),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// users
// ============================================================
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').unique().notNull(),
  name: text('name'),
  role: text('role', { enum: ['admin', 'advisor', 'client', 'vendor'] })
    .notNull()
    .default('advisor'),
  organization_id: text('organization_id').references(() => organizations.id),
  password_hash: text('password_hash'),
  must_change_password: integer('must_change_password', { mode: 'boolean' }).default(false),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// projects
// ============================================================
export const projects = sqliteTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  organization_id: text('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  client_company_name: text('client_company_name').notNull(),
  client_contact_email: text('client_contact_email').notNull(),
  headcount: integer('headcount'),
  tier: text('tier', { enum: ['essentials', 'growth', 'enterprise'] }),
  status: text('status', {
    enum: [
      'intake',
      'discovery_complete',
      'summary_approved',
      'deep_discovery',
      'blueprint_generation',
      'client_review',
      'approved',
      'outputs',
    ],
  })
    .notNull()
    .default('intake'),
  scope_notes: text('scope_notes'),
  readiness_level: text('readiness_level', {
    enum: ['draft_ready', 'demo_ready', 'implementation_ready'],
  }),
  // Phase B — discovery summary & review
  discovery_summary: text('discovery_summary'),      // JSON: "What We Heard"
  recommended_sections: text('recommended_sections'), // JSON: AI-suggested Blueprint sections
  client_edits: text('client_edits'),                // JSON: client corrections + flags
  summary_approved_at: integer('summary_approved_at', { mode: 'timestamp' }),
  // Phase D — Blueprint generation tracking
  generated_at: integer('generated_at', { mode: 'timestamp' }),
  generation_count: integer('generation_count').default(0),
  generation_metadata: text('generation_metadata'), // JSON: which sessions/transcripts included
  self_service_enabled: integer('self_service_enabled', { mode: 'boolean' }).default(false),
  created_by: text('created_by').references(() => users.id),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// project_members
// ============================================================
export const projectMembers = sqliteTable('project_members', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role', { enum: ['advisor', 'client', 'viewer'] }).notNull(),
  invited_at: integer('invited_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  joined_at: integer('joined_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// sessions (discovery chat sessions + transcript uploads)
// session_type:
//   'discovery'      → Phase A quick chat (~5–10 min, light scope)
//   'deep_discovery' → Phase C self-service or stakeholder session (thorough)
//   'transcript'     → Phase C advisor-uploaded transcript (batch processed)
// ============================================================
export const discoverySessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  session_type: text('session_type', {
    enum: ['discovery', 'deep_discovery', 'transcript'],
  }).notNull(),
  status: text('status', { enum: ['active', 'completed'] })
    .notNull()
    .default('active'),
  // Participant info (for stakeholder sessions)
  participant_name: text('participant_name'),
  participant_role: text('participant_role'),
  participant_email: text('participant_email'),
  // Advisor-defined focus areas (JSON string[])
  focus_areas: text('focus_areas'),
  // Transcript-only fields
  transcript_raw: text('transcript_raw'),
  processing_status: text('processing_status', {
    enum: ['pending', 'processing', 'complete', 'failed'],
  }),
  created_by: text('created_by').references(() => users.id),
  // user_id: legacy column kept for DB compatibility with older table definitions
  user_id: text('user_id'),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// chat_messages (messages within a discovery or deep_discovery session)
// ============================================================
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  session_id: text('session_id')
    .notNull()
    .references(() => discoverySessions.id),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  role: text('role', { enum: ['assistant', 'user'] }).notNull(),
  content: text('content').notNull(),
  // Structured data extracted by AI from this message (JSON)
  extractions: text('extractions'),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// tech_stack_systems
// ============================================================
export const techStackSystems = sqliteTable('tech_stack_systems', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  system_name: text('system_name').notNull(),
  vendor: text('vendor'),
  system_type: text('system_type', {
    enum: [
      'primary_hris',
      'payroll',
      'ats',
      'lms',
      'performance',
      'benefits',
      'scheduling',
      'point_solution',
      'other',
    ],
  }),
  is_primary: integer('is_primary', { mode: 'boolean' }).default(false),
  modules_used: text('modules_used'), // JSON array stored as text
  experience_rating: integer('experience_rating'),
  go_live_date: text('go_live_date'),
  contract_end_date: text('contract_end_date'),
  notes: text('notes'),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// integrations
// ============================================================
export const integrations = sqliteTable('integrations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  source_system_id: text('source_system_id')
    .notNull()
    .references(() => techStackSystems.id),
  target_system_id: text('target_system_id')
    .notNull()
    .references(() => techStackSystems.id),
  integration_quality: text('integration_quality', {
    enum: [
      'fully_integrated',
      'mostly_automated',
      'partially_automated',
      'fully_manual',
    ],
  }).notNull(),
  data_types: text('data_types'), // JSON array stored as text
  notes: text('notes'),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// blueprint_sections
// ============================================================
export const blueprintSections = sqliteTable('blueprint_sections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  section_name: text('section_name').notNull(),
  section_key: text('section_key', {
    enum: [
      'payroll',
      'hris',
      'ats',
      'lms',
      'performance',
      'benefits',
      'compensation',
      'onboarding',
    ],
  }).notNull(),
  depth: text('depth', { enum: ['light', 'standard', 'deep'] })
    .notNull()
    .default('standard'),
  status: text('status', {
    enum: [
      'not_started',
      'in_progress',
      'advisor_review',
      'client_approved',
      'complete',
    ],
  })
    .notNull()
    .default('not_started'),
  completeness_score: integer('completeness_score').default(0),
  ai_narrative_current: text('ai_narrative_current'),
  ai_narrative_future: text('ai_narrative_future'),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// requirements
// ============================================================
export const requirements = sqliteTable('requirements', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  section_id: text('section_id')
    .notNull()
    .references(() => blueprintSections.id),
  module: text('module').notNull(),
  sub_process: text('sub_process'),
  actors: text('actors'), // JSON array
  trigger: text('trigger'),
  current_state: text('current_state'),
  future_requirement: text('future_requirement').notNull(),
  exceptions: text('exceptions'),
  integration_dependencies: text('integration_dependencies'),
  reporting_needs: text('reporting_needs'),
  approval_rules: text('approval_rules'),
  geography_entity: text('geography_entity'),
  source: text('source', { enum: ['chat', 'transcript', 'intake', 'advisor'] }),
  criticality: text('criticality', {
    enum: ['must_have', 'should_have', 'could_have', 'wont_have'],
  }),
  business_impact: text('business_impact'),
  frequency: text('frequency'),
  user_population: text('user_population'),
  compliance_regulatory: text('compliance_regulatory'),
  implementation_complexity: text('implementation_complexity', {
    enum: ['low', 'medium', 'high'],
  }),
  differentiator: integer('differentiator', { mode: 'boolean' }).default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// processes
// ============================================================
export const processes = sqliteTable('processes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  section_id: text('section_id')
    .notNull()
    .references(() => blueprintSections.id),
  process_name: text('process_name').notNull(),
  trigger: text('trigger'),
  actors: text('actors'), // JSON array
  steps: text('steps'), // JSON array
  frequency: text('frequency'),
  volume: text('volume'),
  current_systems: text('current_systems'), // JSON array
  pain_points: text('pain_points'), // JSON array
  desired_outcome: text('desired_outcome'),
  integration_touchpoints: text('integration_touchpoints'), // JSON array
  data_inputs: text('data_inputs'), // JSON array
  data_outputs: text('data_outputs'), // JSON array
  approval_chain: text('approval_chain'),
  exceptions_workarounds: text('exceptions_workarounds'),
  source: text('source', { enum: ['chat', 'transcript', 'advisor'] }),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// decisions
// ============================================================
export const decisions = sqliteTable('decisions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  section_id: text('section_id').references(() => blueprintSections.id),
  decision_text: text('decision_text').notNull(),
  decision_date: text('decision_date'),
  decision_makers: text('decision_makers'), // JSON array
  rationale: text('rationale'),
  alternatives_considered: text('alternatives_considered'),
  impact: text('impact'),
  source: text('source', { enum: ['chat', 'transcript', 'advisor'] }),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// open_questions
// ============================================================
export const openQuestions = sqliteTable('open_questions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  section_id: text('section_id').references(() => blueprintSections.id),
  question_text: text('question_text').notNull(),
  status: text('status', {
    enum: [
      'open',
      'pending_client',
      'pending_advisor',
      'conflicting',
      'resolved',
      'deferred',
    ],
  })
    .notNull()
    .default('open'),
  assigned_to: text('assigned_to').references(() => users.id),
  answer: text('answer'),
  source: text('source', { enum: ['chat', 'transcript', 'advisor'] }),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})


// ============================================================
// chat_contexts
// ============================================================
export const chatContexts = sqliteTable('chat_contexts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  advisor_notes: text('advisor_notes'),
  sections_covered: text('sections_covered'), // JSON array
  current_topic: text('current_topic'),
  suggested_next_topics: text('suggested_next_topics'), // JSON array
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// generated_outputs
// ============================================================
export const generatedOutputs = sqliteTable('generated_outputs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  project_id: text('project_id')
    .notNull()
    .references(() => projects.id),
  output_type: text('output_type', {
    enum: [
      'project_summary',
      'tech_stack_viz',
      'discovery_summary',
      'meeting_agenda',
      'scorecard_settings',
      'implementation_blueprint',
    ],
  }).notNull(),
  format: text('format', { enum: ['pdf', 'docx', 'json', 'png'] }),
  status: text('status', { enum: ['generating', 'ready', 'failed'] })
    .notNull()
    .default('generating'),
  content: text('content'),
  file_url: text('file_url'),
  version: integer('version').default(1),
  generated_by: text('generated_by').references(() => users.id),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// vendors
// ============================================================
export const vendors = sqliteTable('vendors', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  product_name: text('product_name').notNull(),
  vendor_company: text('vendor_company'),
  website: text('website'),
  logo_url: text('logo_url'),
  primary_color: text('primary_color'),
  can_be_primary: integer('can_be_primary', { mode: 'boolean' }).default(false),
  suggested_categories: text('suggested_categories'), // JSON array
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_at: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => new Date()
  ),
})

// ============================================================
// Type exports (inferred from schema)
// ============================================================
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

export type ProjectMember = typeof projectMembers.$inferSelect
export type NewProjectMember = typeof projectMembers.$inferInsert

export type DiscoverySession = typeof discoverySessions.$inferSelect
export type NewDiscoverySession = typeof discoverySessions.$inferInsert

export type TechStackSystem = typeof techStackSystems.$inferSelect
export type NewTechStackSystem = typeof techStackSystems.$inferInsert

export type Integration = typeof integrations.$inferSelect
export type NewIntegration = typeof integrations.$inferInsert

export type BlueprintSection = typeof blueprintSections.$inferSelect
export type NewBlueprintSection = typeof blueprintSections.$inferInsert

export type Requirement = typeof requirements.$inferSelect
export type NewRequirement = typeof requirements.$inferInsert

export type Process = typeof processes.$inferSelect
export type NewProcess = typeof processes.$inferInsert

export type Decision = typeof decisions.$inferSelect
export type NewDecision = typeof decisions.$inferInsert

export type OpenQuestion = typeof openQuestions.$inferSelect
export type NewOpenQuestion = typeof openQuestions.$inferInsert

export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert

export type ChatContext = typeof chatContexts.$inferSelect
export type NewChatContext = typeof chatContexts.$inferInsert

export type GeneratedOutput = typeof generatedOutputs.$inferSelect
export type NewGeneratedOutput = typeof generatedOutputs.$inferInsert

export type Vendor = typeof vendors.$inferSelect
export type NewVendor = typeof vendors.$inferInsert

// ============================================================
// app_settings — key/value store for global app configuration
// ============================================================
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
})

export type AppSetting = typeof appSettings.$inferSelect

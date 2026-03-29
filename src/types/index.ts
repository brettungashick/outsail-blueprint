// ============================================================
// OutSail Blueprint — Core TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'advisor' | 'client' | 'vendor'

export type ProjectTier = 'essentials' | 'growth' | 'enterprise'

export type ProjectStatus = 'setup' | 'intake' | 'chat' | 'review' | 'complete'

export type ReadinessLevel = 'draft_ready' | 'demo_ready' | 'implementation_ready'

export type MemberRole = 'advisor' | 'client' | 'viewer'

export type SessionType = 'chat' | 'transcript'

export type ProcessingStatus = 'pending' | 'processing' | 'complete' | 'failed'

export type SystemType =
  | 'primary_hris'
  | 'payroll'
  | 'ats'
  | 'lms'
  | 'performance'
  | 'benefits'
  | 'scheduling'
  | 'point_solution'
  | 'other'

export type IntegrationQuality =
  | 'fully_integrated'
  | 'mostly_automated'
  | 'partially_automated'
  | 'fully_manual'

export type SectionKey =
  | 'payroll'
  | 'hris'
  | 'ats'
  | 'lms'
  | 'performance'
  | 'benefits'
  | 'compensation'
  | 'onboarding'

export type SectionDepth = 'light' | 'standard' | 'deep'

export type SectionStatus =
  | 'not_started'
  | 'in_progress'
  | 'advisor_review'
  | 'client_approved'
  | 'complete'

export type RequirementSource = 'chat' | 'transcript' | 'intake' | 'advisor'

export type Criticality = 'must_have' | 'should_have' | 'could_have' | 'wont_have'

export type ImplementationComplexity = 'low' | 'medium' | 'high'

export type ProcessSource = 'chat' | 'transcript' | 'advisor'

export type QuestionStatus =
  | 'open'
  | 'pending_client'
  | 'pending_advisor'
  | 'conflicting'
  | 'resolved'
  | 'deferred'

export type ChatRole = 'assistant' | 'client' | 'advisor' | 'system'

export type ExtractionStatus = 'none' | 'pending' | 'committed' | 'rejected'

export type OutputType =
  | 'project_summary'
  | 'tech_stack_viz'
  | 'discovery_summary'
  | 'meeting_agenda'
  | 'scorecard_settings'
  | 'implementation_blueprint'

export type OutputFormat = 'pdf' | 'docx' | 'json' | 'png'

export type OutputStatus = 'generating' | 'ready' | 'failed'

// ============================================================
// Entity Types
// ============================================================

export interface Organization {
  id: string
  name: string
  logo_url: string | null
  created_at: Date | null
  updated_at: Date | null
}

export interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  organization_id: string | null
  created_at: Date | null
  updated_at: Date | null
}

export interface Project {
  id: string
  organization_id: string | null
  name: string
  client_company_name: string
  client_contact_email: string
  headcount: number | null
  tier: ProjectTier | null
  status: ProjectStatus
  scope_notes: string | null
  readiness_level: ReadinessLevel | null
  created_by: string | null
  created_at: Date | null
  updated_at: Date | null
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: MemberRole
  invited_at: Date | null
  joined_at: Date | null
  created_at: Date | null
}

export interface Session {
  id: string
  user_id: string
  project_id: string | null
  session_type: SessionType
  transcript_raw: string | null
  processing_status: ProcessingStatus | null
  created_at: Date | null
  updated_at: Date | null
}

export interface TechStackSystem {
  id: string
  project_id: string
  system_name: string
  vendor: string | null
  system_type: SystemType | null
  is_primary: boolean
  modules_used: string[] | null
  experience_rating: number | null
  go_live_date: string | null
  contract_end_date: string | null
  notes: string | null
  created_at: Date | null
}

export interface Integration {
  id: string
  project_id: string
  source_system_id: string
  target_system_id: string
  integration_quality: IntegrationQuality
  data_types: string[] | null
  notes: string | null
  created_at: Date | null
}

export interface BlueprintSection {
  id: string
  project_id: string
  section_name: string
  section_key: SectionKey
  depth: SectionDepth
  status: SectionStatus
  completeness_score: number
  ai_narrative_current: string | null
  ai_narrative_future: string | null
  created_at: Date | null
  updated_at: Date | null
}

export interface Requirement {
  id: string
  project_id: string
  section_id: string
  module: string
  sub_process: string | null
  actors: string[] | null
  trigger: string | null
  current_state: string | null
  future_requirement: string
  exceptions: string | null
  integration_dependencies: string | null
  reporting_needs: string | null
  approval_rules: string | null
  geography_entity: string | null
  source: RequirementSource | null
  criticality: Criticality | null
  business_impact: string | null
  frequency: string | null
  user_population: string | null
  compliance_regulatory: string | null
  implementation_complexity: ImplementationComplexity | null
  differentiator: boolean
  created_at: Date | null
  updated_at: Date | null
}

export interface Process {
  id: string
  project_id: string
  section_id: string
  process_name: string
  trigger: string | null
  actors: string[] | null
  steps: string[] | null
  frequency: string | null
  volume: string | null
  current_systems: string[] | null
  pain_points: string[] | null
  desired_outcome: string | null
  integration_touchpoints: string[] | null
  data_inputs: string[] | null
  data_outputs: string[] | null
  approval_chain: string | null
  exceptions_workarounds: string | null
  source: ProcessSource | null
  created_at: Date | null
  updated_at: Date | null
}

export interface Decision {
  id: string
  project_id: string
  section_id: string | null
  decision_text: string
  decision_date: string | null
  decision_makers: string[] | null
  rationale: string | null
  alternatives_considered: string | null
  impact: string | null
  source: ProcessSource | null
  created_at: Date | null
  updated_at: Date | null
}

export interface OpenQuestion {
  id: string
  project_id: string
  section_id: string | null
  question_text: string
  status: QuestionStatus
  assigned_to: string | null
  answer: string | null
  source: ProcessSource | null
  created_at: Date | null
  updated_at: Date | null
}

export interface ChatMessage {
  id: string
  project_id: string
  role: ChatRole
  content: string
  extractions: Record<string, unknown> | null
  extraction_status: ExtractionStatus
  created_by: string | null
  created_at: Date | null
}

export interface ChatContext {
  id: string
  project_id: string
  advisor_notes: string | null
  sections_covered: string[] | null
  current_topic: string | null
  suggested_next_topics: string[] | null
  updated_at: Date | null
}

export interface GeneratedOutput {
  id: string
  project_id: string
  output_type: OutputType
  format: OutputFormat | null
  status: OutputStatus
  content: string | null
  file_url: string | null
  version: number
  generated_by: string | null
  created_at: Date | null
}

// ============================================================
// API / Session Types
// ============================================================

export interface MagicLinkPayload {
  email: string
  type: 'magic-link'
}

export interface SessionPayload {
  userId: string
  email: string
  role: UserRole
}

export interface AuthSession {
  userId: string
  email: string
  role: UserRole
}

// ============================================================
// UI Helper Types
// ============================================================

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export interface StatsCard {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: React.ComponentType<{ className?: string }>
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Clock, Users, Plus, Trash2, ArrowUp, ArrowDown, Save, ChevronDown, ChevronRight } from 'lucide-react'
import type { SectionKey, SectionDepth, SectionStatus, ProjectTier, ProjectStatus } from '@/types'
import { TechStackViz } from '@/components/tech-stack/tech-stack-viz'
import type { TechStackSystemRow, IntegrationRow } from '@/components/tech-stack/tech-stack-builder'

// ----------------------------------------------------------------
// Exported interface — used by page.tsx
// ----------------------------------------------------------------
export interface ProjectTabsProject {
  id: string
  name: string
  client_company_name: string
  client_contact_email: string
  headcount: number | null
  tier: ProjectTier | null
  status: ProjectStatus
  scope_notes: string | null
  readiness_level: string | null
  // Phase B
  discovery_summary: string | null      // JSON
  recommended_sections: string | null   // JSON
  client_edits: string | null           // JSON
  summary_approved_at: Date | null
  // Phase C
  self_service_enabled: boolean
  scheduling_link: string | null
  question_guide: string | null         // JSON
  created_at: Date | null
  updated_at: Date | null
}

// ----------------------------------------------------------------
// Internal types
// ----------------------------------------------------------------
interface BlueprintSectionData {
  id: string
  section_key: SectionKey
  section_name: string
  depth: SectionDepth
  status: SectionStatus
  completeness_score: number | null
}

interface ProjectTabsProps {
  project: ProjectTabsProject
  blueprintSections: BlueprintSectionData[]
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const TABS = [
  { key: 'overview',       label: 'Overview' },
  { key: 'tech-stack',     label: 'Tech Stack' },
  { key: 'discovery',      label: 'Discovery' },
  { key: 'question-guide', label: 'Question Guide' },
  { key: 'pathway',        label: 'Pathway' },
  { key: 'sessions',       label: 'Sessions' },
  { key: 'blueprint',      label: 'Blueprint' },
  { key: 'outputs',        label: 'Outputs' },
] as const

type TabKey = (typeof TABS)[number]['key']

const STATUS_LABELS: Record<ProjectStatus, string> = {
  intake:               'Intake',
  discovery_complete:   'Discovery Done',
  summary_approved:     'Summary Approved',
  deep_discovery:       'Deep Discovery',
  blueprint_generation: 'Blueprint',
  client_review:        'Client Review',
  approved:             'Approved',
  outputs:              'Outputs',
}

const TIER_LABELS: Record<ProjectTier, string> = {
  essentials: 'Essentials',
  growth:     'Growth',
  enterprise: 'Enterprise',
}

const STATUS_ORDER: ProjectStatus[] = [
  'intake',
  'discovery_complete',
  'summary_approved',
  'deep_discovery',
  'blueprint_generation',
  'client_review',
  'approved',
  'outputs',
]

const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  not_started:    'Not Started',
  in_progress:    'In Progress',
  advisor_review: 'Advisor Review',
  client_approved:'Client Approved',
  complete:       'Complete',
}

const DEPTH_LABELS: Record<SectionDepth, string> = {
  light:    'Light',
  standard: 'Standard',
  deep:     'Deep',
}

// Statuses where discovery data is available
const POST_DISCOVERY: ProjectStatus[] = [
  'summary_approved', 'deep_discovery', 'blueprint_generation',
  'client_review', 'approved', 'outputs',
]

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatRelativeDate(date: Date | null | undefined): string {
  if (!date) return '—'
  const diffMs = new Date().getTime() - new Date(date).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatAbsoluteDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

function SectionStatusDot({ status }: { status: SectionStatus }) {
  const colorMap: Record<SectionStatus, string> = {
    not_started:    'bg-outsail-gray-200',
    in_progress:    'bg-outsail-amber',
    advisor_review: 'bg-outsail-purple',
    client_approved:'bg-outsail-teal',
    complete:       'bg-green-500',
  }
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorMap[status]}`}
      title={SECTION_STATUS_LABELS[status]}
    />
  )
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ----------------------------------------------------------------
// Overview Tab
// ----------------------------------------------------------------
function OverviewTab({ project, blueprintSections }: ProjectTabsProps) {
  const overallCompleteness =
    blueprintSections.length > 0
      ? Math.round(blueprintSections.reduce((sum, s) => sum + (s.completeness_score ?? 0), 0) / blueprintSections.length)
      : 0

  const readinessLabels: Record<string, string> = {
    draft_ready:           'Draft Ready',
    demo_ready:            'Demo Ready',
    implementation_ready:  'Implementation Ready',
  }

  // Parse discovery_summary JSON
  let discoverySummary: {
    overview?: string
    pain_points?: Array<{ description: string; severity?: string }>
    priorities?: Array<{ priority: string; rank?: number }>
    vendors_staying?: Array<{ name: string; reason?: string }>
    vendors_replacing?: Array<{ name: string; reason?: string }>
    complexity_signals?: Array<{ area: string; description: string; severity?: string }>
  } | null = null

  if (project.discovery_summary) {
    try { discoverySummary = JSON.parse(project.discovery_summary) } catch { /* skip */ }
  }

  // Parse client_edits JSON
  let clientEdits: {
    corrections?: string
    anything_else?: string
    section_flags?: Array<{ section: string; priority: string; comment?: string }>
  } | null = null

  if (project.client_edits) {
    try { clientEdits = JSON.parse(project.client_edits) } catch { /* skip */ }
  }

  const showDiscoveryData = POST_DISCOVERY.includes(project.status)

  return (
    <div className="space-y-6">
      {/* Top row: Company Profile + Project Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Company Profile */}
        <div className="lg:col-span-3 outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">Company Profile</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Company Name</p>
              <p className="text-body text-outsail-slate">{project.client_company_name}</p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Contact Email</p>
              <p className="text-body text-outsail-slate break-all">{project.client_contact_email}</p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Headcount</p>
              <p className="text-body text-outsail-slate">
                {project.headcount ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-outsail-gray-600" />
                    {project.headcount.toLocaleString()} employees
                  </span>
                ) : '—'}
              </p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Tier</p>
              <p className="text-body text-outsail-slate">
                {project.tier ? TIER_LABELS[project.tier] : '—'}
              </p>
            </div>
            {project.scope_notes && (
              <div className="col-span-2">
                <p className="text-label text-outsail-gray-600 mb-0.5">Scope Notes</p>
                <p className="text-body text-outsail-slate whitespace-pre-wrap">{project.scope_notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Project Status */}
        <div className="lg:col-span-2 outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">Project Status</h3>

          {/* Status pipeline */}
          <div className="mb-4">
            <p className="text-label text-outsail-gray-600 mb-2">Pipeline Stage</p>
            <div className="flex items-center gap-1 flex-wrap">
              {STATUS_ORDER.map((s, i) => {
                const currentIdx = STATUS_ORDER.indexOf(project.status)
                const isCurrent = s === project.status
                const isPast = i < currentIdx
                return (
                  <React.Fragment key={s}>
                    <div className={`py-1 px-1.5 rounded text-center text-[10px] font-medium transition-colors ${
                      isCurrent  ? 'bg-outsail-teal text-white'
                      : isPast   ? 'bg-outsail-teal-light text-outsail-teal-dark'
                                 : 'bg-outsail-gray-50 text-outsail-gray-600 border border-outsail-gray-200'
                    }`}>
                      {STATUS_LABELS[s]}
                    </div>
                    {i < STATUS_ORDER.length - 1 && (
                      <div className={`w-1.5 h-0.5 flex-shrink-0 ${i < currentIdx ? 'bg-outsail-teal' : 'bg-outsail-gray-200'}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Readiness */}
          <div className="mb-4">
            <p className="text-label text-outsail-gray-600 mb-1.5">Readiness Level</p>
            {project.readiness_level ? (
              <Badge variant="approved">{readinessLabels[project.readiness_level] ?? project.readiness_level}</Badge>
            ) : (
              <span className="text-xs text-outsail-gray-600 italic">Not yet assessed</span>
            )}
          </div>

          {/* Dates */}
          <div className="space-y-2 border-t border-outsail-gray-200 pt-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-label text-outsail-gray-600">Created</p>
              <p className="text-xs text-outsail-slate">{formatAbsoluteDate(project.created_at)}</p>
            </div>
            {project.summary_approved_at && (
              <div className="flex items-center justify-between">
                <p className="text-label text-outsail-gray-600">Summary Approved</p>
                <p className="text-xs text-outsail-slate">{formatAbsoluteDate(project.summary_approved_at)}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-label text-outsail-gray-600">Last Updated</p>
              <p className="text-xs text-outsail-slate flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeDate(project.updated_at ?? project.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Discovery Summary — shown post-discovery */}
      {showDiscoveryData && (
        <div className="outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">What We Heard</h3>
          {discoverySummary ? (
            <div className="space-y-5">
              {discoverySummary.overview && (
                <p className="text-body text-outsail-slate">{discoverySummary.overview}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pain Points */}
                {(discoverySummary.pain_points?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-label text-outsail-gray-600 mb-2">Pain Points</p>
                    <ul className="space-y-1.5">
                      {discoverySummary.pain_points!.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-outsail-slate">
                          <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                            p.severity === 'high'   ? 'bg-red-100 text-red-700'
                            : p.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-outsail-gray-50 text-outsail-gray-600'
                          }`}>
                            {p.severity ?? 'info'}
                          </span>
                          {p.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Priorities */}
                {(discoverySummary.priorities?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-label text-outsail-gray-600 mb-2">Top Priorities</p>
                    <ol className="space-y-1">
                      {discoverySummary.priorities!.map((p, i) => (
                        <li key={i} className="text-sm text-outsail-slate flex items-start gap-2">
                          <span className="font-semibold text-outsail-teal flex-shrink-0">{i + 1}.</span>
                          {p.priority}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Vendors */}
                {((discoverySummary.vendors_staying?.length ?? 0) + (discoverySummary.vendors_replacing?.length ?? 0)) > 0 && (
                  <div>
                    <p className="text-label text-outsail-gray-600 mb-2">Vendor Landscape</p>
                    <div className="flex flex-wrap gap-1.5">
                      {discoverySummary.vendors_staying?.map((v, i) => (
                        <span key={`stay-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-outsail-teal-light text-outsail-teal-dark border border-outsail-teal/20">
                          Keeping: {v.name}
                        </span>
                      ))}
                      {discoverySummary.vendors_replacing?.map((v, i) => (
                        <span key={`rep-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          Replacing: {v.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Complexity Signals */}
                {(discoverySummary.complexity_signals?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-label text-outsail-gray-600 mb-2">Complexity Signals</p>
                    <ul className="space-y-1">
                      {discoverySummary.complexity_signals!.map((c, i) => (
                        <li key={i} className="text-sm text-outsail-slate">
                          <span className="font-medium text-outsail-navy">{c.area}:</span>{' '}
                          {c.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-outsail-gray-600 italic">
              Discovery summary will appear here after the client completes their intake.
            </p>
          )}
        </div>
      )}

      {/* Client Input — shown when client_edits present */}
      {showDiscoveryData && clientEdits && (clientEdits.corrections || clientEdits.anything_else || (clientEdits.section_flags?.length ?? 0) > 0) && (
        <div className="outsail-card border-l-4 border-l-outsail-amber">
          <h3 className="text-header-sm text-outsail-navy mb-4">Client Input</h3>
          <div className="space-y-4">
            {clientEdits.corrections && (
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">Corrections</p>
                <p className="text-sm text-outsail-slate bg-amber-50 rounded-lg p-3 border border-amber-100">
                  {clientEdits.corrections}
                </p>
              </div>
            )}
            {clientEdits.anything_else && (
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">Additional Context</p>
                <p className="text-sm text-outsail-slate bg-outsail-gray-50 rounded-lg p-3 border border-outsail-gray-200">
                  {clientEdits.anything_else}
                </p>
              </div>
            )}
            {(clientEdits.section_flags?.length ?? 0) > 0 && (
              <div>
                <p className="text-label text-outsail-gray-600 mb-2">Section Flags</p>
                <div className="space-y-2">
                  {clientEdits.section_flags!.map((flag, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-outsail-gray-200 bg-outsail-gray-50">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                        flag.priority === 'high'   ? 'bg-red-100 text-red-700'
                        : flag.priority === 'medium' ? 'bg-amber-100 text-amber-700'
                                                      : 'bg-blue-50 text-outsail-blue'
                      }`}>
                        {flag.priority}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-outsail-navy">{flag.section}</p>
                        {flag.comment && <p className="text-sm text-outsail-gray-600 mt-0.5">{flag.comment}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blueprint Sections grid */}
      <div className="outsail-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-header-sm text-outsail-navy">Blueprint Sections</h3>
          <span className="text-sm font-medium text-outsail-gray-600">{overallCompleteness}% Complete</span>
        </div>
        {blueprintSections.length === 0 ? (
          <p className="text-body text-outsail-gray-600 py-4 text-center">No blueprint sections found for this project.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {blueprintSections.map((section) => (
              <div key={section.id} className="rounded-card border border-outsail-gray-200 p-4 hover:border-outsail-teal/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-outsail-navy leading-tight">{section.section_name}</p>
                  <SectionStatusDot status={section.status} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${
                    section.depth === 'light'    ? 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'
                    : section.depth === 'standard' ? 'bg-blue-50 text-outsail-blue border-blue-200'
                                                   : 'bg-outsail-navy/5 text-outsail-navy border-outsail-navy/20'
                  }`}>
                    {DEPTH_LABELS[section.depth]}
                  </span>
                  <span className="text-xs text-outsail-gray-600">{section.completeness_score ?? 0}%</span>
                </div>
                <p className="text-xs text-outsail-gray-600">{SECTION_STATUS_LABELS[section.status]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Tech Stack Tab
// ----------------------------------------------------------------
function TechStackTab({ projectId }: { projectId: string }) {
  const [systems, setSystems] = useState<TechStackSystemRow[] | null>(null)
  const [integrationRows, setIntegrationRows] = useState<IntegrationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/tech-stack`)
        if (!res.ok) throw new Error('Failed to load tech stack')
        const data = await res.json() as {
          systems: Array<{
            id: string; system_name: string; vendor: string | null
            system_type: string | null; is_primary: boolean | null
            modules_used: string | null; experience_rating: number | null; notes: string | null
          }>
          integrations: Array<{ source_system_id: string; target_system_id: string; integration_quality: string }>
        }
        if (cancelled) return
        const parsed: TechStackSystemRow[] = data.systems.map((s) => {
          let modules: string[] = []
          try { if (s.modules_used) modules = JSON.parse(s.modules_used) as string[] } catch { /* empty */ }
          let ratings = { admin: 3, employee: 3, service: 3 }
          try { if (s.notes) { const n = JSON.parse(s.notes) as { ratings?: typeof ratings }; if (n.ratings) ratings = n.ratings } } catch { /* empty */ }
          return { id: s.id, system_name: s.system_name, vendor: s.vendor, system_type: s.system_type, is_primary: s.is_primary ?? false, modules_used: modules, ratings, experience_rating: s.experience_rating }
        })
        const parsedInts: IntegrationRow[] = data.integrations.map((i) => ({ source_id: i.source_system_id, target_id: i.target_system_id, quality: i.integration_quality as IntegrationRow['quality'] }))
        setSystems(parsed)
        setIntegrationRows(parsedInts)
      } catch { setSystems([]) }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return (
      <div className="py-16 text-center text-outsail-gray-600">
        <div className="inline-flex items-center gap-2">
          <Spinner />
          <span className="text-sm">Loading tech stack...</span>
        </div>
      </div>
    )
  }

  if (!systems || systems.length === 0) {
    return (
      <div className="py-16 text-center text-outsail-gray-600">
        <p className="text-sm">No tech stack data yet. The client can add their tech stack from their workspace.</p>
      </div>
    )
  }

  return (
    <div className="outsail-card">
      <h3 className="text-header-sm text-outsail-navy mb-4">Tech Stack Map</h3>
      <TechStackViz systems={systems} integrations={integrationRows} />
    </div>
  )
}

// ----------------------------------------------------------------
// Discovery Tab
// ----------------------------------------------------------------

interface DiscoverySession {
  id: string
  session_type: 'discovery' | 'deep_discovery' | 'transcript'
  status: 'active' | 'completed'
  participant_name: string | null
  participant_role: string | null
  created_at: string | null
}

interface DiscoveryMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string | null
}

interface DiscoveryExtractions {
  pain_points: Array<{ description: string; severity: string; related_system?: string }>
  priorities: Array<{ priority: string; rank: number }>
  vendors_staying: Array<{ name: string; reason?: string }>
  vendors_replacing: Array<{ name: string; reason?: string }>
  complexity_signals: Array<{ area: string; description: string; severity: string }>
}

interface RecommendedSection {
  key: string
  name: string
  depth: 'light' | 'standard' | 'deep'
  rationale?: string
  notes?: string
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  discovery:      'Discovery Chat',
  deep_discovery: 'Deep Discovery',
  transcript:     'Transcript',
}

const SESSION_TYPE_COLORS: Record<string, string> = {
  discovery:      'bg-outsail-teal-light text-outsail-teal-dark',
  deep_discovery: 'bg-purple-100 text-purple-700',
  transcript:     'bg-blue-100 text-outsail-blue',
}

function DiscoveryTab({ project }: { project: ProjectTabsProject }) {
  const [sessions, setSessions]       = useState<DiscoverySession[]>([])
  const [messages, setMessages]       = useState<DiscoveryMessage[]>([])
  const [extractions, setExtractions] = useState<DiscoveryExtractions | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Recommended sections — editable local copy
  const [sections, setSections] = useState<RecommendedSection[]>(() => {
    if (!project.recommended_sections) return []
    try {
      const raw = JSON.parse(project.recommended_sections) as Array<Record<string, string>>
      return raw.map((s) => ({
        key:      s.key ?? s.section_key ?? '',
        name:     s.name ?? s.section_name ?? '',
        depth:    (s.depth as RecommendedSection['depth']) ?? 'standard',
        rationale:s.rationale,
        notes:    s.notes,
      }))
    } catch { return [] }
  })
  const [sectionsDirty, setSectionsDirty] = useState(false)
  const [sectionsSaving, setSectionsSaving] = useState(false)
  const [sectionsSaved, setSectionsSaved]   = useState(false)

  // Expanded session in transcript (default: first)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const transcriptBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/projects/${project.id}/discovery`)
        if (!res.ok) throw new Error('Failed to load discovery data')
        const data = await res.json() as {
          sessions: DiscoverySession[]
          messages: DiscoveryMessage[]
          extractions: DiscoveryExtractions
        }
        if (cancelled) return
        setSessions(data.sessions)
        setMessages(data.messages)
        setExtractions(data.extractions)
        if (data.sessions.length > 0) setExpandedSession(data.sessions[0].id)
      } catch {
        if (!cancelled) setError('Could not load discovery data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [project.id])

  // Scroll transcript to bottom when messages load
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, expandedSession])

  async function saveSections() {
    setSectionsSaving(true)
    try {
      await fetch(`/api/projects/${project.id}/recommended-sections`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      setSectionsDirty(false)
      setSectionsSaved(true)
      setTimeout(() => setSectionsSaved(false), 2500)
    } finally {
      setSectionsSaving(false)
    }
  }

  function updateSection(idx: number, patch: Partial<RecommendedSection>) {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
    setSectionsDirty(true)
    setSectionsSaved(false)
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx))
    setSectionsDirty(true)
    setSectionsSaved(false)
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= sections.length) return
    setSections((prev) => {
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
    setSectionsDirty(true)
    setSectionsSaved(false)
  }

  function addSection() {
    setSections((prev) => [...prev, { key: `section_${Date.now()}`, name: '', depth: 'standard' }])
    setSectionsDirty(true)
    setSectionsSaved(false)
  }

  const hasExtractions = extractions && (
    extractions.pain_points.length > 0 ||
    extractions.priorities.length > 0 ||
    extractions.vendors_staying.length > 0 ||
    extractions.vendors_replacing.length > 0 ||
    extractions.complexity_signals.length > 0
  )

  if (loading) {
    return (
      <div className="py-16 text-center text-outsail-gray-600">
        <div className="inline-flex items-center gap-2">
          <Spinner />
          <span className="text-sm">Loading discovery data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="py-16 text-center text-sm text-red-600">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Top two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT — Transcript */}
        <div className="lg:col-span-3 outsail-card flex flex-col min-h-0">
          <h3 className="text-header-sm text-outsail-navy mb-4">Discovery Transcript</h3>

          {sessions.length === 0 ? (
            <p className="text-sm text-outsail-gray-600 italic py-8 text-center">
              No sessions yet. The transcript will appear here after the client completes the discovery chat.
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.map((sess) => {
                const isOpen = expandedSession === sess.id
                const sessMessages = messages.filter((m) => m.session_id === sess.id)
                return (
                  <div key={sess.id} className="border border-outsail-gray-200 rounded-card overflow-hidden">
                    {/* Session header */}
                    <button
                      onClick={() => setExpandedSession(isOpen ? null : sess.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-outsail-gray-50 hover:bg-outsail-gray-200/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${SESSION_TYPE_COLORS[sess.session_type] ?? 'bg-outsail-gray-50 text-outsail-gray-600'}`}>
                          {SESSION_TYPE_LABELS[sess.session_type] ?? sess.session_type}
                        </span>
                        {sess.participant_name && (
                          <span className="text-sm text-outsail-slate truncate">
                            {sess.participant_name}{sess.participant_role ? ` · ${sess.participant_role}` : ''}
                          </span>
                        )}
                        <span className="text-xs text-outsail-gray-600 flex-shrink-0">
                          {sess.created_at ? formatRelativeDate(new Date(sess.created_at)) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sess.status === 'completed' ? 'bg-outsail-teal-light text-outsail-teal-dark' : 'bg-amber-100 text-amber-700'}`}>
                          {sess.status}
                        </span>
                        {isOpen ? <ChevronDown className="w-4 h-4 text-outsail-gray-600" /> : <ChevronRight className="w-4 h-4 text-outsail-gray-600" />}
                      </div>
                    </button>

                    {/* Messages */}
                    {isOpen && (
                      <div className="max-h-[480px] overflow-y-auto p-4 space-y-3 bg-white">
                        {sessMessages.length === 0 ? (
                          <p className="text-sm text-outsail-gray-600 italic text-center py-4">No messages in this session.</p>
                        ) : (
                          sessMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-outsail-teal text-white rounded-br-sm'
                                  : 'bg-outsail-gray-50 text-outsail-slate border border-outsail-gray-200 rounded-bl-sm'
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={transcriptBottomRef} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Extracted Insights */}
        <div className="lg:col-span-2 outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">Extracted Insights</h3>

          {!hasExtractions ? (
            <p className="text-sm text-outsail-gray-600 italic py-8 text-center">
              No insights extracted yet. Complete the discovery chat to see data here.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Pain Points */}
              {extractions!.pain_points.length > 0 && (
                <div>
                  <p className="text-label text-outsail-gray-600 mb-2">Pain Points</p>
                  <ul className="space-y-2">
                    {extractions!.pain_points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                          p.severity === 'high'   ? 'bg-red-100 text-red-700'
                          : p.severity === 'medium' ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-outsail-gray-50 text-outsail-gray-600'
                        }`}>{p.severity}</span>
                        <span className="text-outsail-slate">{p.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Priorities */}
              {extractions!.priorities.length > 0 && (
                <div>
                  <p className="text-label text-outsail-gray-600 mb-2">Priorities</p>
                  <ol className="space-y-1">
                    {extractions!.priorities.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-outsail-slate">
                        <span className="font-semibold text-outsail-teal flex-shrink-0">{i + 1}.</span>
                        {p.priority}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Vendors */}
              {(extractions!.vendors_staying.length > 0 || extractions!.vendors_replacing.length > 0) && (
                <div>
                  <p className="text-label text-outsail-gray-600 mb-2">Vendors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extractions!.vendors_staying.map((v, i) => (
                      <span key={`s${i}`} className="px-2 py-1 rounded-full text-xs font-medium bg-outsail-teal-light text-outsail-teal-dark border border-outsail-teal/20">
                        Keeping: {v.name}
                      </span>
                    ))}
                    {extractions!.vendors_replacing.map((v, i) => (
                      <span key={`r${i}`} className="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        Replacing: {v.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Complexity */}
              {extractions!.complexity_signals.length > 0 && (
                <div>
                  <p className="text-label text-outsail-gray-600 mb-2">Complexity Signals</p>
                  <ul className="space-y-1.5">
                    {extractions!.complexity_signals.map((c, i) => (
                      <li key={i} className="text-sm text-outsail-slate">
                        <span className="font-medium text-outsail-navy">{c.area}:</span>{' '}{c.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recommended Sections editor */}
      <div className="outsail-card">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-header-sm text-outsail-navy">Recommended Blueprint Sections</h3>
            <p className="text-xs text-outsail-gray-600 mt-0.5">
              Advisor-editable. These drive the Question Guide and Blueprint structure.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {sectionsSaved && (
              <span className="text-xs text-outsail-teal font-medium">Saved ✓</span>
            )}
            <button
              onClick={saveSections}
              disabled={!sectionsDirty || sectionsSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-outsail-teal text-white hover:bg-outsail-teal-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sectionsSaving ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>

        {sections.length === 0 ? (
          <p className="text-sm text-outsail-gray-600 italic py-4 text-center">
            No sections defined yet. They&apos;ll be suggested after the discovery chat. You can also add them manually.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {sections.map((sec, idx) => (
              <div key={sec.key} className="flex items-center gap-2 p-3 rounded-lg border border-outsail-gray-200 bg-outsail-gray-50/50 group">
                {/* Up/down */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    className="text-outsail-gray-600 hover:text-outsail-navy disabled:opacity-25 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === sections.length - 1}
                    className="text-outsail-gray-600 hover:text-outsail-navy disabled:opacity-25 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Section number */}
                <span className="text-xs font-semibold text-outsail-gray-600 w-5 flex-shrink-0 text-center">
                  {idx + 1}
                </span>

                {/* Name */}
                <input
                  type="text"
                  value={sec.name}
                  onChange={(e) => updateSection(idx, { name: e.target.value })}
                  placeholder="Section name"
                  className="flex-1 min-w-0 bg-white border border-outsail-gray-200 rounded-md px-2.5 py-1.5 text-sm text-outsail-slate focus:outline-none focus:border-outsail-teal focus:ring-1 focus:ring-outsail-teal/20"
                />

                {/* Depth */}
                <select
                  value={sec.depth}
                  onChange={(e) => updateSection(idx, { depth: e.target.value as RecommendedSection['depth'] })}
                  className="flex-shrink-0 bg-white border border-outsail-gray-200 rounded-md px-2 py-1.5 text-sm text-outsail-slate focus:outline-none focus:border-outsail-teal"
                >
                  <option value="light">Light</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                </select>

                {/* Notes */}
                <input
                  type="text"
                  value={sec.notes ?? ''}
                  onChange={(e) => updateSection(idx, { notes: e.target.value })}
                  placeholder="Notes (optional)"
                  className="w-40 bg-white border border-outsail-gray-200 rounded-md px-2.5 py-1.5 text-sm text-outsail-slate focus:outline-none focus:border-outsail-teal hidden lg:block"
                />

                {/* Delete */}
                <button
                  onClick={() => removeSection(idx)}
                  className="flex-shrink-0 text-outsail-gray-600 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove section"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={addSection}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-outsail-gray-200 text-outsail-gray-600 hover:text-outsail-navy hover:border-outsail-teal/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Coming Soon placeholder
// ----------------------------------------------------------------
function ComingSoon({ label, description }: { label: string; description?: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium text-outsail-navy mb-1">{label}</p>
      <p className="text-sm text-outsail-gray-600">{description ?? 'Coming soon.'}</p>
    </div>
  )
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------
export function ProjectTabs({ project, blueprintSections }: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-outsail-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-outsail-teal text-outsail-teal'
                    : 'border-transparent text-outsail-gray-600 hover:text-outsail-navy hover:border-outsail-gray-200'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab project={project} blueprintSections={blueprintSections} />
      )}
      {activeTab === 'tech-stack' && (
        <TechStackTab projectId={project.id} />
      )}
      {activeTab === 'discovery' && (
        <DiscoveryTab project={project} />
      )}
      {activeTab === 'question-guide' && (
        <ComingSoon label="Question Guide" description="Generate and manage your discovery question guide here." />
      )}
      {activeTab === 'pathway' && (
        <ComingSoon label="Pathway" description="Manage scheduling, self-service chat, and stakeholder invitations here." />
      )}
      {activeTab === 'sessions' && (
        <ComingSoon label="Sessions" description="All discovery sessions — chat, transcripts, and stakeholder calls — will appear here." />
      )}
      {activeTab === 'blueprint' && (
        <ComingSoon label="Blueprint" description="Blueprint generation will be available once discovery is complete." />
      )}
      {activeTab === 'outputs' && (
        <ComingSoon label="Outputs" description="Outputs will be available after Blueprint approval." />
      )}
    </div>
  )
}

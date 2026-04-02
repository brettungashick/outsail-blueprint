'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wand2,
  Send,
  AlertTriangle,
  CheckCircle,
  Plus,
  X,
  HelpCircle,
  FileText,
  Pencil,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import type { SectionDepth, SectionStatus, ProjectStatus } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface BlueprintSection {
  id: string
  section_key: string
  section_name: string
  depth: SectionDepth
  status: SectionStatus
  completeness_score: number | null
  ai_narrative_current: string | null
  ai_narrative_future: string | null
  updated_at: Date | null
}

interface BlueprintTabProps {
  projectId: string
  projectStatus: ProjectStatus
  companyName: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEPTH_LABELS: Record<SectionDepth, string> = {
  light: 'Light',
  standard: 'Standard',
  deep: 'Deep',
}

const DEPTH_COLORS: Record<SectionDepth, string> = {
  light: 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200',
  standard: 'bg-blue-50 text-outsail-blue border-blue-200',
  deep: 'bg-outsail-navy/5 text-outsail-navy border-outsail-navy/20',
}

const STATUS_LABELS: Record<SectionStatus, string> = {
  not_started: 'Not Started',
  draft: 'Draft',
  in_progress: 'In Progress',
  advisor_review: 'Advisor Review',
  sent_to_client: 'Sent to Client',
  client_approved: 'Client Approved',
  complete: 'Complete',
}

const STATUS_COLORS: Record<SectionStatus, string> = {
  not_started: 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  advisor_review: 'bg-purple-50 text-outsail-purple border-purple-200',
  sent_to_client: 'bg-blue-50 text-outsail-blue border-blue-200',
  client_approved: 'bg-outsail-teal-light text-outsail-teal-dark border-outsail-teal/20',
  complete: 'bg-green-50 text-green-700 border-green-200',
}

// ── Enrichment Types ──────────────────────────────────────────────────────

interface Requirement {
  id: string
  module: string
  future_requirement: string
  sub_process: string | null
  source: string | null
  criticality: string | null
  business_impact: string | null
  frequency: string | null
  user_population: string | null
  compliance_regulatory: string | null
  implementation_complexity: string | null
  differentiator: boolean | null
}

interface OpenQuestion {
  id: string
  question_text: string
  status: string
  assigned_to: string | null
  answer: string | null
  section_id: string | null
  created_at: string | null
}

interface Decision {
  id: string
  decision_text: string
  rationale: string | null
  decision_makers: string | null
  decision_date: string | null
  section_id: string | null
  impact: string | null
  created_at: string | null
}

// Source badge config
const SOURCE_BADGES: Record<string, { label: string; cls: string }> = {
  chat:       { label: 'Client Requirement', cls: 'bg-outsail-teal-light text-outsail-teal-dark border-outsail-teal/20' },
  transcript: { label: 'Client Requirement', cls: 'bg-outsail-teal-light text-outsail-teal-dark border-outsail-teal/20' },
  intake:     { label: 'Client Requirement', cls: 'bg-outsail-teal-light text-outsail-teal-dark border-outsail-teal/20' },
  advisor:    { label: 'OutSail Recommendation', cls: 'bg-purple-50 text-outsail-purple border-purple-200' },
  best_practice: { label: 'Best Practice', cls: 'bg-blue-50 text-outsail-blue border-blue-200' },
}

const CRITICALITY_OPTIONS = [
  { value: 'must_have',    label: 'Must Have' },
  { value: 'should_have',  label: 'Should Have' },
  { value: 'could_have',   label: 'Nice to Have' },
  { value: 'wont_have',    label: 'Future Phase' },
]

const IMPACT_OPTIONS = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const FREQUENCY_OPTIONS = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'monthly',  label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
  { value: 'ad_hoc',   label: 'Ad Hoc' },
]

const COMPLEXITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

const QUESTION_STATUS_OPTIONS = [
  { value: 'open',            label: 'Open' },
  { value: 'pending_client',  label: 'Pending Client' },
  { value: 'pending_advisor', label: 'Pending Advisor' },
  { value: 'resolved',        label: 'Resolved' },
  { value: 'deferred',        label: 'Deferred' },
]

const QUESTION_STATUS_COLORS: Record<string, string> = {
  open:            'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200',
  pending_client:  'bg-amber-50 text-amber-700 border-amber-200',
  pending_advisor: 'bg-blue-50 text-outsail-blue border-blue-200',
  resolved:        'bg-green-50 text-green-700 border-green-200',
  deferred:        'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Requirement Enrichment Panel ──────────────────────────────────────────

function RequirementPanel({
  req,
  projectId,
  onUpdated,
  onDeleted,
}: {
  req: Requirement
  projectId: string
  onUpdated: (patch: Partial<Requirement>) => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    module: req.module,
    future_requirement: req.future_requirement,
    source: req.source ?? 'advisor',
    criticality: req.criticality ?? '',
    business_impact: req.business_impact ?? '',
    frequency: req.frequency ?? '',
    user_population: req.user_population ?? '',
    compliance_regulatory: req.compliance_regulatory ?? '',
    implementation_complexity: req.implementation_complexity ?? '',
    differentiator: req.differentiator ?? false,
  })

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/requirements/${req.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      onUpdated({ ...form, differentiator: form.differentiator })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this requirement?')) return
    await fetch(`/api/projects/${projectId}/requirements/${req.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const sourceBadge = SOURCE_BADGES[form.source] ?? SOURCE_BADGES.advisor!

  return (
    <div className="border border-outsail-gray-200 rounded-lg overflow-hidden">
      {/* Compact row */}
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${sourceBadge.cls}`}>
              {sourceBadge.label}
            </span>
            {form.criticality && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200">
                {CRITICALITY_OPTIONS.find((o) => o.value === form.criticality)?.label ?? form.criticality}
              </span>
            )}
            {form.differentiator && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-outsail-navy/5 text-outsail-navy border-outsail-navy/20">
                Differentiator
              </span>
            )}
          </div>
          <p className="text-sm text-outsail-slate leading-snug">{req.future_requirement}</p>
          {req.sub_process && <p className="text-xs text-outsail-gray-600 mt-0.5">{req.sub_process}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setEditing((v) => !v)} className="p-1.5 rounded text-outsail-gray-600 hover:text-outsail-navy hover:bg-outsail-gray-50">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded text-outsail-gray-600 hover:text-outsail-coral hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="border-t border-outsail-gray-200 p-3 bg-outsail-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-outsail-navy mb-1 block">Source</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal">
                <option value="chat">Client Requirement</option>
                <option value="advisor">OutSail Recommendation</option>
                <option value="best_practice">Best Practice</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-outsail-navy mb-1 block">Criticality</label>
              <select value={form.criticality} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}
                className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal">
                <option value="">— Select —</option>
                {CRITICALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-outsail-navy mb-1 block">Business Impact</label>
              <select value={form.business_impact} onChange={(e) => setForm((f) => ({ ...f, business_impact: e.target.value }))}
                className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal">
                <option value="">— Select —</option>
                {IMPACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-outsail-navy mb-1 block">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal">
                <option value="">— Select —</option>
                {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-outsail-navy mb-1 block">Impl. Complexity</label>
              <select value={form.implementation_complexity} onChange={(e) => setForm((f) => ({ ...f, implementation_complexity: e.target.value }))}
                className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal">
                <option value="">— Select —</option>
                {COMPLEXITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-outsail-navy mb-1 block">User Population</label>
              <input type="text" value={form.user_population} onChange={(e) => setForm((f) => ({ ...f, user_population: e.target.value }))}
                placeholder="e.g. All Employees, HR Only…"
                className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-outsail-navy mb-1 block">Compliance / Regulatory</label>
            <input type="text" value={form.compliance_regulatory} onChange={(e) => setForm((f) => ({ ...f, compliance_regulatory: e.target.value }))}
              placeholder="e.g. FLSA, ACA, GDPR…"
              className="w-full text-sm border border-outsail-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-outsail-teal" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id={`diff-${req.id}`} checked={form.differentiator}
              onChange={(e) => setForm((f) => ({ ...f, differentiator: e.target.checked }))}
              className="accent-outsail-teal" />
            <label htmlFor={`diff-${req.id}`} className="text-sm text-outsail-slate cursor-pointer">
              Differentiator (vs. table stakes)
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-outsail-teal text-white text-xs font-medium rounded-lg disabled:opacity-50">
              {saving ? <Spinner className="w-3 h-3" /> : null} Save
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-outsail-gray-600 hover:text-outsail-navy">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RequirementsSection({ sectionId, projectId }: { sectionId: string; projectId: string }) {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newReq, setNewReq] = useState('')
  const [newModule, setNewModule] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/sections/${sectionId}/requirements`)
      if (res.ok) {
        const data = await res.json() as { requirements: Requirement[] }
        setReqs(data.requirements)
        setLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function addRequirement() {
    if (!newReq.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/sections/${sectionId}/requirements`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ module: newModule || 'General', future_requirement: newReq.trim(), source: 'advisor' }),
      })
      if (res.ok) {
        const data = await res.json() as { id: string }
        setReqs((p) => [...p, {
          id: data.id, module: newModule || 'General', future_requirement: newReq.trim(),
          sub_process: null, source: 'advisor', criticality: null, business_impact: null,
          frequency: null, user_population: null, compliance_regulatory: null,
          implementation_complexity: null, differentiator: false,
        }])
        setNewReq(''); setNewModule(''); setAdding(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-t border-outsail-gray-200 mt-4">
      <button
        onClick={() => { if (!loaded) void load(); }}
        className="w-full flex items-center justify-between px-5 py-3 bg-outsail-gray-50 hover:bg-outsail-gray-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-outsail-navy uppercase tracking-wide">
          Requirements {loaded && reqs.length > 0 ? `(${reqs.length})` : ''}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); if (!loaded) void load(); setAdding(true) }}
          className="flex items-center gap-1 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </button>

      {loaded && (
        <div className="p-4 space-y-2">
          {loading && <div className="text-sm text-outsail-gray-600 text-center py-4"><Spinner className="w-4 h-4 mx-auto" /></div>}
          {!loading && reqs.length === 0 && !adding && (
            <p className="text-xs text-outsail-gray-600 italic text-center py-2">No requirements yet. Click Add to create one.</p>
          )}
          {reqs.map((r) => (
            <RequirementPanel
              key={r.id}
              req={r}
              projectId={projectId}
              onUpdated={(patch) => setReqs((p) => p.map((x) => x.id === r.id ? { ...x, ...patch } : x))}
              onDeleted={() => setReqs((p) => p.filter((x) => x.id !== r.id))}
            />
          ))}
          {adding && (
            <div className="border border-outsail-teal/30 rounded-lg p-3 bg-outsail-teal-light/20 space-y-2">
              <input type="text" value={newModule} onChange={(e) => setNewModule(e.target.value)}
                placeholder="Module (e.g. Payroll Processing)"
                className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal" />
              <textarea value={newReq} onChange={(e) => setNewReq(e.target.value)} rows={2}
                placeholder="Describe the future requirement…"
                className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal resize-none" />
              <div className="flex items-center gap-2">
                <button onClick={() => void addRequirement()} disabled={!newReq.trim() || submitting}
                  className="px-3 py-1.5 bg-outsail-teal text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  {submitting ? <Spinner className="w-3 h-3" /> : 'Add'}
                </button>
                <button onClick={() => { setAdding(false); setNewReq(''); setNewModule('') }}
                  className="text-xs text-outsail-gray-600 hover:text-outsail-navy">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────

function SectionCard({
  section,
  projectId,
  onUpdated,
  onRegenerateOne,
  isRegenerating,
}: {
  section: BlueprintSection
  projectId: string
  onUpdated: (id: string, patch: Partial<BlueprintSection>) => void
  onRegenerateOne: (sectionId: string) => void
  isRegenerating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [currentText, setCurrentText] = useState(section.ai_narrative_current ?? '')
  const [futureText, setFutureText] = useState(section.ai_narrative_future ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync when section narratives update externally (after regeneration)
  useEffect(() => {
    setCurrentText(section.ai_narrative_current ?? '')
    setFutureText(section.ai_narrative_future ?? '')
  }, [section.ai_narrative_current, section.ai_narrative_future])

  const hasEdits =
    currentText !== (section.ai_narrative_current ?? '') ||
    futureText !== (section.ai_narrative_future ?? '')

  async function saveNarratives(curr: string, fut: string) {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/projects/${projectId}/blueprint-sections`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          section_id: section.id,
          ai_narrative_current: curr,
          ai_narrative_future: fut,
          status: 'advisor_review',
        }),
      })
      onUpdated(section.id, {
        ai_narrative_current: curr,
        ai_narrative_future: fut,
        status: 'advisor_review',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function handleCurrentChange(val: string) {
    setCurrentText(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveNarratives(val, futureText), 1500)
  }

  function handleFutureChange(val: string) {
    setFutureText(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void saveNarratives(currentText, val), 1500)
  }

  function handleRegenerateClick() {
    if (hasEdits) {
      if (!confirm('This section has manual edits that will be overwritten. Regenerate anyway?')) return
    }
    onRegenerateOne(section.id)
  }

  const isEmpty = !section.ai_narrative_current && !section.ai_narrative_future

  return (
    <div className="outsail-card p-0 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-outsail-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-outsail-gray-600 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-outsail-gray-600 flex-shrink-0" />
          )}
          <span className="font-semibold text-outsail-navy truncate">{section.section_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${DEPTH_COLORS[section.depth]}`}>
            {DEPTH_LABELS[section.depth]}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[section.status]}`}>
            {STATUS_LABELS[section.status]}
          </span>
          {isEmpty && (
            <span className="text-xs text-outsail-gray-600 italic">Not generated</span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-outsail-gray-200">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 bg-outsail-gray-50 border-b border-outsail-gray-200">
            <div className="flex items-center gap-2 text-xs text-outsail-gray-600">
              {saving && (
                <>
                  <Spinner className="w-3 h-3" />
                  <span>Saving…</span>
                </>
              )}
              {saved && !saving && (
                <>
                  <CheckCircle className="w-3 h-3 text-outsail-teal" />
                  <span className="text-outsail-teal">Saved</span>
                </>
              )}
              {!saving && !saved && hasEdits && (
                <span className="text-amber-600">Unsaved changes</span>
              )}
            </div>
            <button
              onClick={handleRegenerateClick}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 text-xs font-medium text-outsail-gray-600 hover:text-outsail-navy disabled:opacity-40 transition-colors"
            >
              {isRegenerating ? (
                <Spinner className="w-3 h-3" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Regenerate
            </button>
          </div>

          {isRegenerating ? (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-outsail-gray-600">
              <Spinner className="w-5 h-5" />
              <span>Generating section…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-outsail-gray-200">
              {/* Current State */}
              <div className="p-5">
                <p className="text-label text-outsail-gray-600 mb-2 uppercase tracking-wide text-xs">
                  Current State
                </p>
                <textarea
                  value={currentText}
                  onChange={(e) => handleCurrentChange(e.target.value)}
                  placeholder="Current state narrative will appear here after generation…"
                  rows={12}
                  className="w-full text-sm text-outsail-slate leading-relaxed resize-y border border-outsail-gray-200 rounded-lg p-3 focus:outline-none focus:border-outsail-teal transition-colors placeholder:text-outsail-gray-600/50"
                />
              </div>

              {/* Future State */}
              <div className="p-5">
                <p className="text-label text-outsail-gray-600 mb-2 uppercase tracking-wide text-xs">
                  Future State
                </p>
                <textarea
                  value={futureText}
                  onChange={(e) => handleFutureChange(e.target.value)}
                  placeholder="Future state requirements will appear here after generation…"
                  rows={12}
                  className="w-full text-sm text-outsail-slate leading-relaxed resize-y border border-outsail-gray-200 rounded-lg p-3 focus:outline-none focus:border-outsail-teal transition-colors placeholder:text-outsail-gray-600/50"
                />
              </div>
            </div>
          )}

          {/* Requirements section */}
          <RequirementsSection sectionId={section.id} projectId={projectId} />
        </div>
      )}
    </div>
  )
}

// ── Open Questions Panel ───────────────────────────────────────────────────

function OpenQuestionsPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [questions, setQuestions] = useState<OpenQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/questions`)
      if (res.ok) {
        const data = await res.json() as { questions: OpenQuestion[] }
        setQuestions(data.questions)
        setLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function addQuestion() {
    if (!newText.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question_text: newText.trim() }),
      })
      if (res.ok) {
        const data = await res.json() as { id: string }
        setQuestions((p) => [...p, { id: data.id, question_text: newText.trim(), status: 'open', assigned_to: null, answer: null, section_id: null, created_at: new Date().toISOString() }])
        setNewText(''); setAdding(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(qid: string, status: string) {
    await fetch(`/api/projects/${projectId}/questions/${qid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setQuestions((p) => p.map((q) => q.id === qid ? { ...q, status } : q))
  }

  async function deleteQuestion(qid: string) {
    await fetch(`/api/projects/${projectId}/questions/${qid}`, { method: 'DELETE' })
    setQuestions((p) => p.filter((q) => q.id !== qid))
  }

  const openCount = questions.filter((q) => !['resolved', 'deferred'].includes(q.status)).length

  return (
    <div className="outsail-card p-0 overflow-hidden">
      <button
        onClick={() => { setOpen((v) => !v); if (!loaded) void load() }}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-outsail-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-outsail-gray-600" />
          <span className="font-semibold text-outsail-navy text-sm">Open Questions</span>
          {openCount > 0 && (
            <span className="text-xs bg-outsail-amber text-white px-1.5 py-0.5 rounded-full font-medium">{openCount}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); if (!loaded) void load(); setAdding(true); setOpen(true) }}
            className="flex items-center gap-1 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {open ? <ChevronDown className="w-4 h-4 text-outsail-gray-600" /> : <ChevronRight className="w-4 h-4 text-outsail-gray-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-outsail-gray-200 p-4 space-y-3">
          {loading && <div className="py-4 flex justify-center"><Spinner className="w-5 h-5 text-outsail-teal" /></div>}
          {!loading && questions.length === 0 && !adding && (
            <p className="text-sm text-outsail-gray-600 text-center py-2 italic">No open questions yet.</p>
          )}
          {questions.map((q) => (
            <div key={q.id} className="flex items-start gap-3 p-3 border border-outsail-gray-200 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-outsail-slate">{q.question_text}</p>
                {q.answer && (
                  <p className="text-xs text-outsail-gray-600 mt-1 italic">Answer: {q.answer}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={q.status}
                  onChange={(e) => void updateStatus(q.id, e.target.value)}
                  className={`text-xs border rounded-full px-2 py-0.5 font-medium focus:outline-none ${QUESTION_STATUS_COLORS[q.status] ?? ''}`}
                >
                  {QUESTION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={() => void deleteQuestion(q.id)} className="text-outsail-gray-600 hover:text-outsail-coral">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {adding && (
            <div className="border border-outsail-teal/30 rounded-lg p-3 bg-outsail-teal-light/20 space-y-2">
              <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={2}
                placeholder="What do you need to clarify?"
                className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal resize-none" />
              <div className="flex items-center gap-2">
                <button onClick={() => void addQuestion()} disabled={!newText.trim() || submitting}
                  className="px-3 py-1.5 bg-outsail-teal text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  {submitting ? <Spinner className="w-3 h-3" /> : 'Add'}
                </button>
                <button onClick={() => { setAdding(false); setNewText('') }}
                  className="text-xs text-outsail-gray-600 hover:text-outsail-navy">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Decision Log Panel ─────────────────────────────────────────────────────

function DecisionLogPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ decision_text: '', rationale: '', decision_makers: '', decision_date: '' })

  async function load() {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/decisions`)
      if (res.ok) {
        const data = await res.json() as { decisions: Decision[] }
        setDecisions(data.decisions)
        setLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function addDecision() {
    if (!form.decision_text.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/decisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json() as { id: string }
        setDecisions((p) => [...p, {
          id: data.id, decision_text: form.decision_text.trim(),
          rationale: form.rationale || null, decision_makers: form.decision_makers || null,
          decision_date: form.decision_date || null, section_id: null, impact: null,
          created_at: new Date().toISOString(),
        }])
        setForm({ decision_text: '', rationale: '', decision_makers: '', decision_date: '' })
        setAdding(false)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteDecision(id: string) {
    await fetch(`/api/projects/${projectId}/decisions`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision_id: id }),
    })
    setDecisions((p) => p.filter((d) => d.id !== id))
  }

  return (
    <div className="outsail-card p-0 overflow-hidden">
      <button
        onClick={() => { setOpen((v) => !v); if (!loaded) void load() }}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-outsail-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-outsail-gray-600" />
          <span className="font-semibold text-outsail-navy text-sm">Decision Log</span>
          {loaded && decisions.length > 0 && (
            <span className="text-xs text-outsail-gray-600">({decisions.length})</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); if (!loaded) void load(); setAdding(true); setOpen(true) }}
            className="flex items-center gap-1 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          {open ? <ChevronDown className="w-4 h-4 text-outsail-gray-600" /> : <ChevronRight className="w-4 h-4 text-outsail-gray-600" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-outsail-gray-200 p-4 space-y-3">
          {loading && <div className="py-4 flex justify-center"><Spinner className="w-5 h-5 text-outsail-teal" /></div>}
          {!loading && decisions.length === 0 && !adding && (
            <p className="text-sm text-outsail-gray-600 text-center py-2 italic">No decisions logged yet.</p>
          )}
          {decisions.map((d) => (
            <div key={d.id} className="p-3 border border-outsail-gray-200 rounded-lg space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-outsail-slate">{d.decision_text}</p>
                <button onClick={() => void deleteDecision(d.id)} className="text-outsail-gray-600 hover:text-outsail-coral flex-shrink-0 mt-0.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {d.rationale && <p className="text-xs text-outsail-gray-600">Rationale: {d.rationale}</p>}
              {d.decision_makers && <p className="text-xs text-outsail-gray-600">Decision makers: {d.decision_makers}</p>}
              {d.decision_date && <p className="text-xs text-outsail-gray-600">Date: {d.decision_date}</p>}
            </div>
          ))}
          {adding && (
            <div className="border border-outsail-teal/30 rounded-lg p-3 bg-outsail-teal-light/20 space-y-2">
              <textarea value={form.decision_text} onChange={(e) => setForm((f) => ({ ...f, decision_text: e.target.value }))}
                rows={2} placeholder="What was decided?"
                className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal resize-none" />
              <input type="text" value={form.rationale} onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))}
                placeholder="Rationale (optional)"
                className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={form.decision_makers} onChange={(e) => setForm((f) => ({ ...f, decision_makers: e.target.value }))}
                  placeholder="Decision makers"
                  className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal" />
                <input type="date" value={form.decision_date} onChange={(e) => setForm((f) => ({ ...f, decision_date: e.target.value }))}
                  className="w-full text-sm border border-outsail-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-outsail-teal" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void addDecision()} disabled={!form.decision_text.trim() || submitting}
                  className="px-3 py-1.5 bg-outsail-teal text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  {submitting ? <Spinner className="w-3 h-3" /> : 'Save'}
                </button>
                <button onClick={() => { setAdding(false); setForm({ decision_text: '', rationale: '', decision_makers: '', decision_date: '' }) }}
                  className="text-xs text-outsail-gray-600 hover:text-outsail-navy">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Readiness Indicator ────────────────────────────────────────────────────

function ReadinessIndicator({ sections, projectId }: { sections: BlueprintSection[]; projectId: string }) {
  const total = sections.length
  if (total === 0) return null

  const hasDraft = sections.some((s) => s.ai_narrative_current || s.ai_narrative_future)
  const advisorReviewCount = sections.filter((s) => ['advisor_review', 'sent_to_client', 'client_approved', 'complete'].includes(s.status)).length
  const approvedCount = sections.filter((s) => ['client_approved', 'complete'].includes(s.status)).length

  let level: 'none' | 'draft_ready' | 'demo_ready' | 'implementation_ready' = 'none'
  if (approvedCount === total) level = 'implementation_ready'
  else if (advisorReviewCount / total >= 0.5) level = 'demo_ready'
  else if (hasDraft) level = 'draft_ready'

  const levels = [
    { key: 'draft_ready',           label: 'Draft Ready',           desc: 'Blueprint narratives generated' },
    { key: 'demo_ready',            label: 'Demo Ready',            desc: '50%+ sections in advisor review' },
    { key: 'implementation_ready',  label: 'Implementation Ready',  desc: 'All sections client-approved' },
  ]

  const activeIdx = level === 'none' ? -1 : levels.findIndex((l) => l.key === level)

  return (
    <div className="outsail-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-header-sm text-outsail-navy">Blueprint Readiness</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
          level === 'implementation_ready' ? 'bg-outsail-teal-light text-outsail-teal-dark border-outsail-teal/20'
          : level === 'demo_ready' ? 'bg-blue-50 text-outsail-blue border-blue-200'
          : level === 'draft_ready' ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'
        }`}>
          {level === 'none' ? 'Not Started' : levels.find((l) => l.key === level)?.label ?? level}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {levels.map((l, i) => {
          const done = i <= activeIdx
          return (
            <div key={l.key} className="flex-1">
              <div className={`h-1.5 rounded-full ${i === 0 ? 'rounded-l-full' : ''} ${i === levels.length - 1 ? 'rounded-r-full' : ''} ${done ? 'bg-outsail-teal' : 'bg-outsail-gray-200'}`} />
              <p className={`text-[10px] mt-1.5 font-medium ${done ? 'text-outsail-teal-dark' : 'text-outsail-gray-600'}`}>{l.label}</p>
              <p className="text-[10px] text-outsail-gray-600">{l.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main BlueprintTab component ────────────────────────────────────────────

export function BlueprintTab({ projectId, projectStatus, companyName }: BlueprintTabProps) {
  const [sections, setSections] = useState<BlueprintSection[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState<{ current: number; total: number; section: string } | null>(null)
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null)
  const [sendingForReview, setSendingForReview] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)

  const loadSections = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/blueprint-sections`)
      if (res.ok) {
        const data = await res.json() as { sections: BlueprintSection[] }
        setSections(data.sections)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadSections()
  }, [loadSections])

  function handleSectionUpdated(id: string, patch: Partial<BlueprintSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function generateAll() {
    if (generating) return

    // Check for manual edits
    const hasEdits = sections.some(
      (s) =>
        (s.ai_narrative_current || s.ai_narrative_future) &&
        s.status === 'advisor_review'
    )
    if (hasEdits) {
      if (!confirm('Some sections have manual edits that will be overwritten. Regenerate all sections anyway?')) {
        return
      }
    }

    setGenerating(true)
    setGeneratingProgress({ current: 0, total: sections.length, section: '' })

    try {
      const res = await fetch('/api/ai/generate-blueprint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      })

      if (!res.ok || !res.body) throw new Error('Failed to start generation')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string
              index?: number
              total?: number
              section?: string
            }
            if (event.type === 'section_start') {
              setGeneratingProgress({
                current: event.index ?? 0,
                total: event.total ?? sections.length,
                section: event.section ?? '',
              })
            }
          } catch { /* skip malformed */ }
        }
      }

      // Reload sections after generation
      await loadSections()
    } catch (err) {
      console.error('[BlueprintTab] Generation error:', err)
      alert('Blueprint generation failed. Please try again.')
    } finally {
      setGenerating(false)
      setGeneratingProgress(null)
    }
  }

  async function regenerateOne(sectionId: string) {
    if (generating || regeneratingSectionId) return
    setRegeneratingSectionId(sectionId)

    try {
      const res = await fetch('/api/ai/generate-blueprint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, section_ids: [sectionId] }),
      })
      if (!res.ok || !res.body) throw new Error('Failed to regenerate section')

      // Drain stream
      const reader = res.body.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      await loadSections()
    } catch (err) {
      console.error('[BlueprintTab] Regeneration error:', err)
      alert('Section regeneration failed. Please try again.')
    } finally {
      setRegeneratingSectionId(null)
    }
  }

  async function sendForReview() {
    if (sendingForReview) return

    const draftCount = sections.filter((s) => s.status === 'draft' || s.status === 'in_progress' || s.status === 'advisor_review').length
    if (draftCount === 0) {
      alert('No sections ready to send.')
      return
    }

    if (!confirm(`Send Blueprint to ${companyName} for review? This will notify them by email.`)) return

    setSendingForReview(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/send-for-review`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to send for review')
      setSendSuccess(true)
      // Update local section statuses
      setSections((prev) =>
        prev.map((s) =>
          ['draft', 'in_progress', 'advisor_review'].includes(s.status)
            ? { ...s, status: 'sent_to_client' as SectionStatus }
            : s
        )
      )
    } catch (err) {
      console.error('[BlueprintTab] Send for review error:', err)
      alert('Failed to send Blueprint for review. Please try again.')
    } finally {
      setSendingForReview(false)
    }
  }

  // Statuses where generating makes sense
  const canGenerate = ['summary_approved', 'deep_discovery', 'blueprint_generation'].includes(projectStatus)
  const canSendForReview = ['blueprint_generation'].includes(projectStatus)
  const hasSections = sections.length > 0
  const hasGeneratedSections = sections.some((s) => s.ai_narrative_current || s.ai_narrative_future)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-6 h-6 text-outsail-teal" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-header-sm text-outsail-navy">Blueprint Sections</h2>
          {hasSections && (
            <p className="text-xs text-outsail-gray-600 mt-0.5">
              {sections.length} section{sections.length !== 1 ? 's' : ''} — edit narratives directly, changes auto-save
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasGeneratedSections && canGenerate && (
            <button
              onClick={() => void generateAll()}
              disabled={generating || !!regeneratingSectionId}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-outsail-gray-600 border border-outsail-gray-200 rounded-lg hover:bg-outsail-gray-50 disabled:opacity-40 transition-colors"
            >
              {generating ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              Regenerate All
            </button>
          )}
          {canGenerate && !hasGeneratedSections && (
            <button
              onClick={() => void generateAll()}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-outsail-teal text-white text-sm font-medium rounded-lg hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors"
            >
              {generating ? <Spinner className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Blueprint'}
            </button>
          )}
          {canGenerate && hasGeneratedSections && canSendForReview && !sendSuccess && (
            <button
              onClick={() => void sendForReview()}
              disabled={sendingForReview || generating}
              className="flex items-center gap-2 px-4 py-2 bg-outsail-teal text-white text-sm font-medium rounded-lg hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors"
            >
              {sendingForReview ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {sendingForReview ? 'Sending…' : 'Send for Client Review'}
            </button>
          )}
          {sendSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-outsail-teal font-medium">
              <CheckCircle className="w-4 h-4" />
              Sent to client
            </span>
          )}
        </div>
      </div>

      {/* Generation progress bar */}
      {generating && generatingProgress && (
        <div className="outsail-card bg-outsail-teal-light border-outsail-teal/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-outsail-teal-dark">
              Generating section {generatingProgress.current} of {generatingProgress.total}
              {generatingProgress.section && `: ${generatingProgress.section}`}
            </p>
            <Spinner className="w-4 h-4 text-outsail-teal" />
          </div>
          <div className="w-full bg-white/60 rounded-full h-1.5">
            <div
              className="bg-outsail-teal h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(generatingProgress.current / generatingProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasSections && !generating && (
        <div className="outsail-card py-16 text-center">
          <Wand2 className="w-8 h-8 text-outsail-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-outsail-navy mb-1">No Blueprint sections yet</p>
          <p className="text-sm text-outsail-gray-600 mb-4">
            {canGenerate
              ? 'Generate the Blueprint to create narratives for each section based on your discovery data.'
              : 'Complete discovery first, then return here to generate the Blueprint.'}
          </p>
          {canGenerate && (
            <button
              onClick={() => void generateAll()}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-outsail-teal text-white text-sm font-medium rounded-lg hover:bg-outsail-teal-dark transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              Generate Blueprint
            </button>
          )}
        </div>
      )}

      {/* Not yet generated but has sections */}
      {hasSections && !hasGeneratedSections && !generating && canGenerate && (
        <div className="rounded-card bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Sections ready — narratives not yet generated</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Click Generate Blueprint above to create Current State and Future State narratives for all {sections.length} sections.
            </p>
          </div>
        </div>
      )}

      {/* Readiness indicator */}
      {hasSections && (
        <ReadinessIndicator sections={sections} projectId={projectId} />
      )}

      {/* Section cards */}
      {hasSections && (
        <div className="space-y-3">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              projectId={projectId}
              onUpdated={handleSectionUpdated}
              onRegenerateOne={(id) => void regenerateOne(id)}
              isRegenerating={regeneratingSectionId === section.id}
            />
          ))}
        </div>
      )}

      {/* Open Questions + Decision Log */}
      {hasSections && (
        <div className="space-y-3">
          <OpenQuestionsPanel projectId={projectId} />
          <DecisionLogPanel projectId={projectId} />
        </div>
      )}
    </div>
  )
}

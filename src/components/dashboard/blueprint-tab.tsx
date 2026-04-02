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

// ── Helpers ────────────────────────────────────────────────────────────────

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
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
        </div>
      )}
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
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, GripVertical, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import type { DiscoverySummaryData, RecommendedSection, ClientEdits } from './page'

interface SummaryReviewClientProps {
  projectId: string
  companyName: string
  discoverySummary: DiscoverySummaryData | null
  recommendedSections: RecommendedSection[]
  initialClientEdits: ClientEdits | null
  isApproved: boolean
  advisorEmail: string | null
}

const DEPTH_LABELS: Record<string, string> = {
  light: 'Light',
  standard: 'Standard',
  deep: 'Deep',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-outsail-red bg-red-50 border-red-200',
  high: 'text-outsail-amber bg-amber-50 border-amber-200',
  medium: 'text-outsail-blue bg-blue-50 border-blue-200',
  low: 'text-outsail-gray-600 bg-outsail-gray-50 border-outsail-gray-200',
}

const SEVERITY_DOT: Record<string, string> = {
  high: 'bg-outsail-red',
  medium: 'bg-outsail-amber',
  low: 'bg-outsail-green',
}

const DEPTH_BADGE: Record<string, string> = {
  light: 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200',
  standard: 'bg-blue-50 text-outsail-blue border-blue-200',
  deep: 'bg-outsail-navy/5 text-outsail-navy border-outsail-navy/20',
}

function SectionCollapse({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="outsail-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>{title}</div>
        {open ? <ChevronUp className="w-4 h-4 text-outsail-gray-600" /> : <ChevronDown className="w-4 h-4 text-outsail-gray-600" />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function SummaryReviewClient({
  projectId,
  companyName,
  discoverySummary,
  recommendedSections,
  initialClientEdits,
  isApproved,
}: SummaryReviewClientProps) {
  const router = useRouter()

  // Editable state — initialized from discovery_summary (or client_edits if re-visiting)
  const [painPoints, setPainPoints] = useState<Array<{ description: string; severity: string }>>(
    initialClientEdits?.pain_points ?? discoverySummary?.pain_points ?? []
  )
  const [priorities, setPriorities] = useState<Array<{ priority: string; rank: number }>>(
    initialClientEdits?.priorities ?? discoverySummary?.priorities ?? []
  )
  const [vendorsStaying, setVendorsStaying] = useState<Array<{ name: string }>>(
    initialClientEdits?.vendors_staying ??
      (discoverySummary?.vendors_staying?.map((v) => ({ name: v.name })) ?? [])
  )
  const [vendorsReplacing, setVendorsReplacing] = useState<Array<{ name: string }>>(
    initialClientEdits?.vendors_replacing ??
      (discoverySummary?.vendors_replacing?.map((v) => ({ name: v.name })) ?? [])
  )
  const [additionalContext, setAdditionalContext] = useState(
    initialClientEdits?.additional_context ?? ''
  )
  const [sectionFlags, setSectionFlags] = useState<Record<string, string>>(
    initialClientEdits?.section_flags ?? {}
  )

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Handlers ────────────────────────────────────────────────────────────

  function updatePainPoint(i: number, field: 'description' | 'severity', value: string) {
    setPainPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)))
  }
  function removePainPoint(i: number) {
    setPainPoints((prev) => prev.filter((_, idx) => idx !== i))
  }
  function addPainPoint() {
    setPainPoints((prev) => [...prev, { description: '', severity: 'medium' }])
  }

  function updatePriority(i: number, value: string) {
    setPriorities((prev) => prev.map((p, idx) => (idx === i ? { ...p, priority: value } : p)))
  }
  function removePriority(i: number) {
    setPriorities((prev) =>
      prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, rank: idx + 1 }))
    )
  }
  function addPriority() {
    setPriorities((prev) => [...prev, { priority: '', rank: prev.length + 1 }])
  }

  function updateVendorName(
    list: Array<{ name: string }>,
    setList: React.Dispatch<React.SetStateAction<Array<{ name: string }>>>,
    i: number,
    value: string
  ) {
    setList((prev) => prev.map((v, idx) => (idx === i ? { name: value } : v)))
  }
  function removeVendor(
    setList: React.Dispatch<React.SetStateAction<Array<{ name: string }>>>,
    i: number
  ) {
    setList((prev) => prev.filter((_, idx) => idx !== i))
  }
  function addVendor(setList: React.Dispatch<React.SetStateAction<Array<{ name: string }>>>) {
    setList((prev) => [...prev, { name: '' }])
  }

  function updateSectionFlag(key: string, note: string) {
    setSectionFlags((prev) => ({ ...prev, [key]: note }))
  }
  function clearSectionFlag(key: string) {
    setSectionFlags((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // ── Approve handler ─────────────────────────────────────────────────────

  async function handleApprove() {
    setIsSaving(true)
    setSaveError(null)

    const clientEdits: ClientEdits = {
      pain_points: painPoints,
      priorities,
      vendors_staying: vendorsStaying,
      vendors_replacing: vendorsReplacing,
      additional_context: additionalContext || undefined,
      section_flags: Object.keys(sectionFlags).length > 0 ? sectionFlags : undefined,
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/approve-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEdits }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }

      router.push('/workspace')
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
      setIsSaving(false)
    }
  }

  // ── Approved waiting state ───────────────────────────────────────────────

  if (isApproved) {
    return (
      <div className="space-y-6">
        <div className="outsail-card flex items-center gap-4 border-2 border-outsail-teal bg-outsail-teal-light">
          <CheckCircle2 className="w-8 h-8 text-outsail-teal flex-shrink-0" />
          <div>
            <h2 className="text-header-sm text-outsail-navy">Summary Submitted</h2>
            <p className="text-body text-outsail-gray-600 mt-0.5">
              Your advisor has been notified and will be in touch to schedule the next step.
            </p>
          </div>
        </div>

        <div className="outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">What Happens Next</h3>
          <ol className="space-y-3">
            {[
              { step: 1, label: 'Your advisor reviews your summary and priorities' },
              { step: 2, label: 'A discovery session is scheduled to go deeper on requirements' },
              { step: 3, label: 'Your Blueprint document is generated and shared for review' },
            ].map(({ step, label }) => (
              <li key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-outsail-teal text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step}
                </span>
                <p className="text-body text-outsail-slate">{label}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Read-only summary below */}
        {discoverySummary?.overview && (
          <div className="outsail-card">
            <h3 className="text-header-sm text-outsail-navy mb-2">What We Captured</h3>
            <p className="text-body text-outsail-slate">{discoverySummary.overview}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Editable review UI ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Overview */}
      {discoverySummary?.overview && (
        <div className="outsail-card bg-outsail-teal-light border-outsail-teal/30">
          <p className="text-sm font-semibold text-outsail-teal mb-1">Discovery Overview</p>
          <p className="text-body text-outsail-slate">{discoverySummary.overview}</p>
        </div>
      )}

      {/* ── Section: Pain Points ─────────────────────────────────────── */}
      <SectionCollapse
        title={<h2 className="text-header-sm text-outsail-navy">Pain Points</h2>}
      >
        <div className="space-y-2">
          {painPoints.map((pp, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={pp.severity}
                onChange={(e) => updatePainPoint(i, 'severity', e.target.value)}
                className="text-xs border border-outsail-gray-200 rounded px-2 py-1.5 text-outsail-slate bg-white"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                type="text"
                value={pp.description}
                onChange={(e) => updatePainPoint(i, 'description', e.target.value)}
                className="flex-1 text-sm border border-outsail-gray-200 rounded px-3 py-1.5 text-outsail-slate focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
              />
              <button onClick={() => removePainPoint(i)} className="p-1 text-outsail-gray-600 hover:text-outsail-red">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addPainPoint}
            className="flex items-center gap-1.5 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium mt-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add pain point
          </button>
        </div>
      </SectionCollapse>

      {/* ── Section: Priorities ──────────────────────────────────────── */}
      <SectionCollapse
        title={<h2 className="text-header-sm text-outsail-navy">Top Priorities</h2>}
      >
        <div className="space-y-2">
          {priorities.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-outsail-teal w-5 text-center flex-shrink-0">
                {p.rank}
              </span>
              <GripVertical className="w-4 h-4 text-outsail-gray-200 flex-shrink-0" />
              <input
                type="text"
                value={p.priority}
                onChange={(e) => updatePriority(i, e.target.value)}
                className="flex-1 text-sm border border-outsail-gray-200 rounded px-3 py-1.5 text-outsail-slate focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
              />
              <button onClick={() => removePriority(i)} className="p-1 text-outsail-gray-600 hover:text-outsail-red">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addPriority}
            className="flex items-center gap-1.5 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium mt-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add priority
          </button>
        </div>
      </SectionCollapse>

      {/* ── Section: Vendors ─────────────────────────────────────────── */}
      <SectionCollapse
        title={<h2 className="text-header-sm text-outsail-navy">Vendor Plans</h2>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-label text-outsail-gray-600 mb-2">Keeping</p>
            <div className="space-y-2">
              {vendorsStaying.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-outsail-teal flex-shrink-0" />
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateVendorName(vendorsStaying, setVendorsStaying, i, e.target.value)}
                    className="flex-1 text-sm border border-outsail-gray-200 rounded px-3 py-1.5 text-outsail-slate focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
                  />
                  <button onClick={() => removeVendor(setVendorsStaying, i)} className="p-1 text-outsail-gray-600 hover:text-outsail-red">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addVendor(setVendorsStaying)}
                className="flex items-center gap-1.5 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
          <div>
            <p className="text-label text-outsail-gray-600 mb-2">Replacing</p>
            <div className="space-y-2">
              {vendorsReplacing.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-outsail-coral flex-shrink-0" />
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateVendorName(vendorsReplacing, setVendorsReplacing, i, e.target.value)}
                    className="flex-1 text-sm border border-outsail-gray-200 rounded px-3 py-1.5 text-outsail-slate focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
                  />
                  <button onClick={() => removeVendor(setVendorsReplacing, i)} className="p-1 text-outsail-gray-600 hover:text-outsail-red">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addVendor(setVendorsReplacing)}
                className="flex items-center gap-1.5 text-xs text-outsail-teal hover:text-outsail-teal-dark font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </SectionCollapse>

      {/* ── Section: Complexity signals ───────────────────────────────── */}
      {(discoverySummary?.complexity_signals?.length ?? 0) > 0 && (
        <SectionCollapse
          title={<h2 className="text-header-sm text-outsail-navy">Complexity Flags</h2>}
        >
          <ul className="space-y-2">
            {discoverySummary!.complexity_signals!.map((cs, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${SEVERITY_DOT[cs.severity] ?? 'bg-outsail-gray-200'}`} />
                <div>
                  <span className="text-sm font-semibold text-outsail-navy">{cs.area}: </span>
                  <span className="text-sm text-outsail-slate">{cs.description}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-outsail-gray-600 mt-3 italic">
            Complexity flags are informational — your advisor will address these during the deep discovery phase.
          </p>
        </SectionCollapse>
      )}

      {/* ── Section: Recommended Blueprint Focus Areas ────────────────── */}
      {recommendedSections.length > 0 && (
        <div className="outsail-card">
          <h2 className="text-header-sm text-outsail-navy mb-1">Recommended Blueprint Focus Areas</h2>
          <p className="text-sm text-outsail-gray-600 mb-4">
            Based on your discovery, here's the suggested Blueprint structure. You can flag any section with notes for your advisor.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recommendedSections.map((section) => (
              <div
                key={section.key}
                className="rounded-card border border-outsail-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-outsail-navy">{section.title}</p>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${DEPTH_BADGE[section.recommended_depth] ?? ''}`}>
                    {DEPTH_LABELS[section.recommended_depth]}
                  </span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border inline-block mb-2 ${PRIORITY_COLORS[section.discovery_priority] ?? ''}`}>
                  {section.discovery_priority}
                </span>
                {section.notes && (
                  <p className="text-xs text-outsail-gray-600 mb-3">{section.notes}</p>
                )}
                {/* Client note input */}
                {sectionFlags[section.key] !== undefined ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={sectionFlags[section.key]}
                      onChange={(e) => updateSectionFlag(section.key, e.target.value)}
                      placeholder="Add a note for your advisor..."
                      className="flex-1 text-xs border border-outsail-amber/60 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-outsail-amber"
                    />
                    <button onClick={() => clearSectionFlag(section.key)} className="p-1 text-outsail-gray-600 hover:text-outsail-red">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => updateSectionFlag(section.key, '')}
                    className="text-xs text-outsail-gray-600 hover:text-outsail-navy underline"
                  >
                    Add a note
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Anything else ─────────────────────────────────────────────── */}
      <div className="outsail-card">
        <h2 className="text-header-sm text-outsail-navy mb-1">Anything Else We Should Know?</h2>
        <p className="text-sm text-outsail-gray-600 mb-3">
          Any context, corrections, or details not covered in the chat.
        </p>
        <textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Optional — add any context, corrections, or details here..."
          rows={4}
          className="w-full text-sm border border-outsail-gray-200 rounded-lg px-3 py-2.5 text-outsail-slate placeholder-outsail-gray-600 focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal resize-none"
        />
      </div>

      {/* ── Approve button ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-outsail-gray-600">
          Once you submit, your advisor will be notified and reach out to schedule the next step.
        </p>
        <button
          onClick={() => void handleApprove()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold text-white bg-outsail-teal hover:bg-outsail-teal-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : (
            'Looks Good — Notify My Advisor'
          )}
        </button>
      </div>

      {saveError && (
        <p className="text-sm text-outsail-red bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {saveError}
        </p>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  FileText, Map, MessageSquare, Calendar, BarChart2, BookOpen,
  Download, RefreshCw, ChevronDown, ChevronUp, Lock, CheckCircle2,
  Settings, X, Loader2, AlertTriangle, Edit3, Save
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type OutputType =
  | 'project_summary'
  | 'tech_stack_viz'
  | 'discovery_summary'
  | 'meeting_agenda'
  | 'scorecard_settings'
  | 'implementation_blueprint'

type ReadinessLevel = 'draft_ready' | 'demo_ready' | 'implementation_ready' | null

interface OutputRecord {
  id: string
  output_type: OutputType
  status: 'generating' | 'ready' | 'failed'
  version: number
  format: string | null
  created_at: number | null
}

interface OutputCardDef {
  type: OutputType
  label: string
  description: string
  icon: React.FC<{ className?: string }>
  readiness: 'draft_ready' | 'demo_ready' | 'implementation_ready'
  readinessLabel: string
  formats: Array<'pdf' | 'docx' | 'json'>
  hasConfig: boolean
}

const OUTPUT_CARDS: OutputCardDef[] = [
  {
    type: 'project_summary',
    label: 'Project Summary',
    description: '1–2 page executive overview of the project, current state, and objectives.',
    icon: FileText,
    readiness: 'draft_ready',
    readinessLabel: 'Draft Ready',
    formats: ['pdf', 'docx'],
    hasConfig: false,
  },
  {
    type: 'tech_stack_viz',
    label: 'Tech Stack Visualization',
    description: 'Visual map of current systems and integrations with company branding.',
    icon: Map,
    readiness: 'draft_ready',
    readinessLabel: 'Draft Ready',
    formats: ['pdf'],
    hasConfig: false,
  },
  {
    type: 'discovery_summary',
    label: 'Discovery Summary',
    description: 'Vendor-facing requirements document with all modules and integration needs.',
    icon: MessageSquare,
    readiness: 'demo_ready',
    readinessLabel: 'Demo Ready',
    formats: ['pdf', 'docx'],
    hasConfig: false,
  },
  {
    type: 'meeting_agenda',
    label: 'Meeting Agenda',
    description: 'Time-boxed vendor demo agenda with targeted questions and show-me scenarios.',
    icon: Calendar,
    readiness: 'demo_ready',
    readinessLabel: 'Demo Ready',
    formats: ['pdf', 'docx'],
    hasConfig: true,
  },
  {
    type: 'scorecard_settings',
    label: 'Scorecard Settings',
    description: '6–10 evaluation categories with weighted criteria and scoring guidance.',
    icon: BarChart2,
    readiness: 'demo_ready',
    readinessLabel: 'Demo Ready',
    formats: ['json'],
    hasConfig: false,
  },
  {
    type: 'implementation_blueprint',
    label: 'Implementation Blueprint',
    description: 'Comprehensive Reed Smith-style document covering all requirements, integrations, and implementation plan.',
    icon: BookOpen,
    readiness: 'implementation_ready',
    readinessLabel: 'Implementation Ready',
    formats: ['pdf', 'docx'],
    hasConfig: false,
  },
]

const READINESS_ORDER: Record<string, number> = {
  draft_ready: 0,
  demo_ready: 1,
  implementation_ready: 2,
}

const READINESS_LABELS: Record<string, string> = {
  draft_ready: 'Draft Ready',
  demo_ready: 'Demo Ready',
  implementation_ready: 'Implementation Ready',
}

const READINESS_COLORS: Record<string, string> = {
  draft_ready: 'bg-outsail-amber/15 text-amber-700 border-outsail-amber/30',
  demo_ready: 'bg-outsail-teal-light text-outsail-teal border-outsail-teal/30',
  implementation_ready: 'bg-purple-50 text-purple-700 border-purple-200',
}

function ReadinessGate({ children, cardReadiness, projectReadiness }: {
  children: React.ReactNode
  cardReadiness: 'draft_ready' | 'demo_ready' | 'implementation_ready'
  projectReadiness: ReadinessLevel
}) {
  const projectLevel = READINESS_ORDER[projectReadiness ?? 'draft_ready'] ?? 0
  const requiredLevel = READINESS_ORDER[cardReadiness]
  const isUnlocked = projectLevel >= requiredLevel

  if (isUnlocked) return <>{children}</>

  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 rounded-lg">
        <Lock className="w-6 h-6 text-outsail-gray-600 mb-2" />
        <p className="text-sm font-medium text-outsail-gray-600">Requires {READINESS_LABELS[cardReadiness]}</p>
      </div>
    </div>
  )
}

function AgendaConfigModal({ onClose, onSubmit, loading }: {
  onClose: () => void
  onSubmit: (config: { vendor_name: string; duration_minutes: number; attendees: string; focus_areas: string[] }) => void
  loading: boolean
}) {
  const [vendorName, setVendorName] = useState('')
  const [duration, setDuration] = useState(60)
  const [attendees, setAttendees] = useState('')
  const [focusInput, setFocusInput] = useState('')
  const [focusAreas, setFocusAreas] = useState<string[]>([])

  function addFocus() {
    const trimmed = focusInput.trim()
    if (trimmed && !focusAreas.includes(trimmed)) {
      setFocusAreas([...focusAreas, trimmed])
      setFocusInput('')
    }
  }

  function removeFocus(area: string) {
    setFocusAreas(focusAreas.filter(a => a !== area))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-outsail-navy">Configure Meeting Agenda</h3>
          <button onClick={onClose} className="text-outsail-gray-600 hover:text-outsail-navy">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-outsail-slate mb-1">Vendor Name *</label>
            <input
              type="text"
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              placeholder="e.g. Workday, ADP"
              className="w-full border border-outsail-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-outsail-slate mb-1">Duration (minutes)</label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full border border-outsail-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-outsail-slate mb-1">Attendees</label>
            <input
              type="text"
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="e.g. HR VP, IT Director, Payroll Manager"
              className="w-full border border-outsail-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-outsail-slate mb-1">Focus Areas</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={focusInput}
                onChange={e => setFocusInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFocus())}
                placeholder="Add a focus area..."
                className="flex-1 border border-outsail-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30"
              />
              <button
                onClick={addFocus}
                className="px-3 py-2 bg-outsail-teal text-white rounded-lg text-sm hover:bg-outsail-teal-dark transition-colors"
              >
                Add
              </button>
            </div>
            {focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {focusAreas.map(area => (
                  <span key={area} className="inline-flex items-center gap-1 bg-outsail-teal-light text-outsail-teal text-xs px-2 py-1 rounded-full">
                    {area}
                    <button onClick={() => removeFocus(area)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-outsail-gray-200 rounded-lg text-sm text-outsail-gray-600 hover:bg-outsail-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!vendorName.trim()) return
              onSubmit({ vendor_name: vendorName.trim(), duration_minutes: duration, attendees, focus_areas: focusAreas })
            }}
            disabled={!vendorName.trim() || loading}
            className="flex-1 py-2 bg-outsail-teal text-white rounded-lg text-sm font-medium hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : 'Generate Agenda'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OutputCard({
  card,
  projectId,
  output,
  projectReadiness,
  onGenerated,
}: {
  card: OutputCardDef
  projectId: string
  output: OutputRecord | null
  projectReadiness: ReadinessLevel
  onGenerated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [content, setContent] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const hasOutput = !!output && output.status === 'ready'

  async function loadContent() {
    if (!output) return
    const res = await fetch(`/api/projects/${projectId}/outputs/${output.id}`)
    if (res.ok) {
      const data = await res.json() as { content: string | null }
      setContent(data.content)
    }
  }

  useEffect(() => {
    if (expanded && output && content === null) {
      loadContent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, output])

  async function generate(config?: Record<string, unknown>) {
    setGenerating(true)
    setProgress('Starting...')
    setError('')
    setContent(null)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ai/generate-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, output_type: card.type, config: config ?? {} }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let generatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; message?: string; text?: string; output_id?: string }
            if (event.type === 'progress') setProgress(event.message ?? '')
            if (event.type === 'chunk') generatedContent += event.text ?? ''
            if (event.type === 'done') {
              setContent(generatedContent)
              onGenerated()
            }
            if (event.type === 'error') setError(event.message ?? 'Generation failed')
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setGenerating(false)
      setProgress('')
      setConfigLoading(false)
    }
  }

  async function saveEdits() {
    if (!output) return
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/outputs/${output.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editValue }),
      })
      setContent(editValue)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function startEdit() {
    setEditValue(content ?? '')
    setEditing(true)
  }

  const projectLevel = READINESS_ORDER[projectReadiness ?? 'draft_ready'] ?? 0
  const requiredLevel = READINESS_ORDER[card.readiness]
  const isUnlocked = projectLevel >= requiredLevel

  const Icon = card.icon

  return (
    <div className={cn(
      'outsail-card transition-all duration-200',
      !isUnlocked && 'opacity-60'
    )}>
      <div
        className="flex items-start gap-4 cursor-pointer"
        onClick={() => isUnlocked && setExpanded(!expanded)}
      >
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          hasOutput ? 'bg-outsail-teal-light' : 'bg-outsail-gray-50'
        )}>
          <Icon className={cn('w-5 h-5', hasOutput ? 'text-outsail-teal' : 'text-outsail-gray-600')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-outsail-navy text-sm">{card.label}</h3>
            <span className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full border',
              READINESS_COLORS[card.readiness]
            )}>
              {card.readinessLabel}
            </span>
            {hasOutput && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                v{output.version}
              </span>
            )}
            {!isUnlocked && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-outsail-gray-50 text-outsail-gray-600 border border-outsail-gray-200 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>
          <p className="text-xs text-outsail-gray-600 mt-0.5">{card.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isUnlocked && (
            <>
              {card.hasConfig ? (
                <button
                  onClick={e => { e.stopPropagation(); setShowConfig(true) }}
                  disabled={generating}
                  className="p-1.5 text-outsail-gray-600 hover:text-outsail-navy hover:bg-outsail-gray-50 rounded-md transition-colors disabled:opacity-50"
                  title="Configure & Generate"
                >
                  <Settings className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); generate() }}
                  disabled={generating}
                  className="p-1.5 text-outsail-gray-600 hover:text-outsail-navy hover:bg-outsail-gray-50 rounded-md transition-colors disabled:opacity-50"
                  title={hasOutput ? 'Regenerate' : 'Generate'}
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </>
          )}
          {isUnlocked && expanded ? (
            <ChevronUp className="w-4 h-4 text-outsail-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-outsail-gray-600" />
          )}
        </div>
      </div>

      {/* Generation progress */}
      {generating && (
        <div className="mt-3 flex items-center gap-2 text-sm text-outsail-gray-600">
          <Loader2 className="w-4 h-4 animate-spin text-outsail-teal" />
          <span>{progress || 'Generating...'}</span>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Expanded content */}
      {expanded && isUnlocked && (
        <div className="mt-4 border-t border-outsail-gray-200 pt-4">
          {/* Actions */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {hasOutput && !editing && (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-outsail-gray-200 rounded-lg text-outsail-gray-600 hover:text-outsail-navy hover:bg-outsail-gray-50 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                {card.formats.map(fmt => (
                  <a
                    key={fmt}
                    href={`/api/projects/${projectId}/outputs/export?output_id=${output.id}&format=${fmt}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-outsail-teal/30 bg-outsail-teal-light rounded-lg text-outsail-teal hover:bg-outsail-teal hover:text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {fmt.toUpperCase()}
                  </a>
                ))}
              </>
            )}
            {editing && (
              <>
                <button
                  onClick={saveEdits}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-outsail-teal text-white rounded-lg hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-outsail-gray-200 rounded-lg text-outsail-gray-600 hover:bg-outsail-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </>
            )}
          </div>

          {/* Content display */}
          {content === null && hasOutput && (
            <div className="flex items-center gap-2 text-sm text-outsail-gray-600 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading content...
            </div>
          )}

          {content !== null && !editing && (
            <div className="bg-outsail-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              {card.type === 'scorecard_settings' ? (
                <ScorecardViewer content={content} />
              ) : (
                <MarkdownPreview content={content} />
              )}
            </div>
          )}

          {editing && (
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="w-full h-[500px] border border-outsail-gray-200 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 resize-none"
            />
          )}

          {!hasOutput && !generating && !content && (
            <div className="text-center py-8 text-outsail-gray-600">
              <p className="text-sm mb-3">This output hasn&apos;t been generated yet.</p>
              {card.hasConfig ? (
                <button
                  onClick={() => setShowConfig(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-outsail-teal text-white rounded-lg text-sm hover:bg-outsail-teal-dark transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Configure & Generate
                </button>
              ) : (
                <button
                  onClick={() => generate()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-outsail-teal text-white rounded-lg text-sm hover:bg-outsail-teal-dark transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Generate Now
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showConfig && (
        <AgendaConfigModal
          loading={configLoading}
          onClose={() => setShowConfig(false)}
          onSubmit={(cfg) => {
            setConfigLoading(true)
            setShowConfig(false)
            setExpanded(true)
            generate(cfg as Record<string, unknown>)
          }}
        />
      )}
    </div>
  )
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1 text-sm">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-outsail-navy mt-4 mb-2">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-outsail-navy mt-3 mb-1.5">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-outsail-slate mt-2 mb-1">{line.slice(4)}</h3>
        if (line.startsWith('#### ')) return <h4 key={i} className="text-sm font-semibold text-outsail-slate mt-1.5 mb-0.5">{line.slice(5)}</h4>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-outsail-slate list-disc">{line.slice(2)}</li>
        if (line.match(/^\d+\. /)) return <li key={i} className="ml-4 text-outsail-slate list-decimal">{line.replace(/^\d+\. /, '')}</li>
        if (line.startsWith('---') || line.trim() === '') return <div key={i} className="h-2" />
        if (line.startsWith('|')) return <code key={i} className="block text-xs font-mono text-outsail-gray-600 py-0.5 overflow-x-auto whitespace-nowrap">{line}</code>
        // Inline bold
        const parts = line.split(/\*\*(.+?)\*\*/)
        if (parts.length > 1) {
          return (
            <p key={i} className="text-outsail-slate">
              {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
            </p>
          )
        }
        return <p key={i} className="text-outsail-slate">{line}</p>
      })}
    </div>
  )
}

function ScorecardViewer({ content }: { content: string }) {
  let scorecard: {
    title?: string
    categories?: Array<{
      name: string
      weight: number
      description?: string
      criteria: Array<{ question: string; guidance?: string }>
    }>
  } | null = null

  try {
    scorecard = JSON.parse(content)
  } catch {
    return <pre className="text-xs font-mono text-outsail-slate whitespace-pre-wrap">{content}</pre>
  }

  if (!scorecard) return null

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-outsail-navy">{scorecard.title}</h2>
      {(scorecard.categories ?? []).map((cat, i) => (
        <div key={i} className="border border-outsail-gray-200 rounded-lg overflow-hidden">
          <div className="bg-outsail-gray-50 px-4 py-2 flex items-center justify-between">
            <span className="font-medium text-sm text-outsail-navy">{cat.name}</span>
            <span className="text-xs text-outsail-gray-600">Weight: {Math.round((cat.weight ?? 0) * 100)}%</span>
          </div>
          {cat.description && (
            <p className="px-4 pt-2 text-xs text-outsail-gray-600">{cat.description}</p>
          )}
          <div className="divide-y divide-outsail-gray-200">
            {(cat.criteria ?? []).map((criterion, j) => (
              <div key={j} className="px-4 py-2">
                <p className="text-sm text-outsail-slate">{criterion.question}</p>
                {criterion.guidance && (
                  <p className="text-xs text-outsail-gray-600 mt-0.5 italic">{criterion.guidance}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main OutputsTab ────────────────────────────────────────────────────────

interface OutputsTabProps {
  projectId: string
  projectStatus: string
}

export function OutputsTab({ projectId, projectStatus }: OutputsTabProps) {
  const [outputs, setOutputs] = useState<OutputRecord[]>([])
  const [readinessLevel, setReadinessLevel] = useState<ReadinessLevel>(null)
  const [loading, setLoading] = useState(true)

  const fetchOutputs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/outputs`)
      if (res.ok) {
        const data = await res.json() as { outputs: OutputRecord[]; readiness_level: ReadinessLevel }
        setOutputs(data.outputs)
        setReadinessLevel(data.readiness_level)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchOutputs()
  }, [fetchOutputs])

  // Compute effective readiness from project status if not set
  const effectiveReadiness: ReadinessLevel = readinessLevel ?? (
    projectStatus === 'approved' || projectStatus === 'outputs' ? 'implementation_ready' :
    projectStatus === 'client_review' ? 'demo_ready' :
    projectStatus === 'blueprint_generation' || projectStatus === 'deep_discovery' ? 'demo_ready' :
    'draft_ready'
  )

  const currentLevel = READINESS_ORDER[effectiveReadiness ?? 'draft_ready'] ?? 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-outsail-teal" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Readiness banner */}
      <div className="outsail-card flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-outsail-navy">Output Readiness</p>
          <p className="text-xs text-outsail-gray-600 mt-0.5">
            Current level unlocks certain output types. Readiness advances as Blueprint sections are approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['draft_ready', 'demo_ready', 'implementation_ready'] as const).map((level, idx) => (
            <div key={level} className="flex items-center gap-1.5">
              {idx > 0 && <div className={cn('w-6 h-0.5', currentLevel >= idx ? 'bg-outsail-teal' : 'bg-outsail-gray-200')} />}
              <div className={cn(
                'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border',
                currentLevel >= idx ? READINESS_COLORS[level] : 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'
              )}>
                {currentLevel >= idx && <CheckCircle2 className="w-3 h-3" />}
                {READINESS_LABELS[level]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Output cards */}
      <div className="space-y-3">
        {OUTPUT_CARDS.map(card => {
          const output = outputs.find(o => o.output_type === card.type) ?? null
          return (
            <OutputCard
              key={card.type}
              card={card}
              projectId={projectId}
              output={output}
              projectReadiness={effectiveReadiness}
              onGenerated={fetchOutputs}
            />
          )
        })}
      </div>
    </div>
  )
}

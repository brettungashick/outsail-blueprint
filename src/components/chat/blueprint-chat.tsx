'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, ChevronRight, ChevronLeft, CheckCircle2, LogOut } from 'lucide-react'
import { createId } from '@paralleldrive/cuid2'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BlueprintChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  isStreaming?: boolean
}

export interface Extractions {
  pain_points?: Array<{ description: string; severity: string; related_system?: string }>
  priorities?: Array<{ priority: string; rank: number }>
  vendors_staying?: Array<{ name: string; reason?: string }>
  vendors_replacing?: Array<{ name: string; reason?: string }>
  project_params?: {
    go_live_date?: string
    budget_status?: string
    decision_team?: string
    vendor_include?: string[]
    vendor_exclude?: string[]
  }
  complexity_signals?: Array<{ area: string; description: string; severity: string }>
  topics_covered?: string[]
  is_complete?: boolean
}

export interface BlueprintChatProps {
  sessionType: 'discovery' | 'deep_discovery'
  projectId: string
  sessionId: string
  participant: { name: string; role: string; email: string }
  focusAreas?: string[]
  recommendedSections?: Array<{ key: string; name: string }>
  reopenNote?: string | null
  onComplete?: () => void
  onDone?: () => Promise<void>
  initialMessages?: BlueprintChatMessage[]
}

// ── Discovery topic tracking ───────────────────────────────────────────────

const DISCOVERY_TOPICS = [
  { key: 'pain_points', label: 'Pain Points' },
  { key: 'vendor_landscape', label: 'Vendors' },
  { key: 'complexities', label: 'Complexities' },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-outsail-teal/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', {
        'bg-outsail-red': severity === 'high',
        'bg-outsail-amber': severity === 'medium',
        'bg-outsail-green': severity === 'low',
      })}
    />
  )
}

function ExtractionPanel({
  extractions,
  topicsCovered,
  isOpen,
  onToggle,
}: {
  extractions: Extractions
  topicsCovered: string[]
  isOpen: boolean
  onToggle: () => void
}) {
  const hasSomething =
    (extractions.pain_points?.length ?? 0) > 0 ||
    (extractions.priorities?.length ?? 0) > 0 ||
    (extractions.vendors_staying?.length ?? 0) > 0 ||
    (extractions.vendors_replacing?.length ?? 0) > 0 ||
    (extractions.complexity_signals?.length ?? 0) > 0

  return (
    <div
      className={cn(
        'flex flex-col border-l border-outsail-gray-200 bg-white transition-all duration-200 flex-shrink-0',
        isOpen ? 'w-72' : 'w-10'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-b border-outsail-gray-200 text-outsail-gray-600 hover:text-outsail-navy transition-colors flex-shrink-0"
        title={isOpen ? 'Collapse panel' : 'What we\'ve captured'}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <p className="text-label font-semibold text-outsail-navy">What We've Captured</p>

          {!hasSomething && (
            <p className="text-xs text-outsail-gray-600 italic">
              Details will appear here as the conversation progresses.
            </p>
          )}

          {(extractions.pain_points?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-2">
                Pain Points
              </p>
              <ul className="space-y-1.5">
                {extractions.pain_points!.map((pp, i) => (
                  <li key={i} className="flex gap-2 text-xs text-outsail-slate">
                    <SeverityDot severity={pp.severity} />
                    <span>{pp.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(extractions.priorities?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-2">
                Priorities
              </p>
              <ol className="space-y-1">
                {extractions.priorities!.map((p, i) => (
                  <li key={i} className="text-xs text-outsail-slate flex gap-2">
                    <span className="text-outsail-teal font-semibold">{p.rank}.</span>
                    {p.priority}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {((extractions.vendors_staying?.length ?? 0) > 0 ||
            (extractions.vendors_replacing?.length ?? 0) > 0) && (
            <div>
              <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-2">
                Vendors
              </p>
              {(extractions.vendors_staying?.length ?? 0) > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-outsail-gray-600 mb-1">Keeping:</p>
                  {extractions.vendors_staying!.map((v, i) => (
                    <span
                      key={i}
                      className="inline-block text-xs bg-outsail-teal-light text-outsail-teal-dark px-2 py-0.5 rounded-full mr-1 mb-1"
                    >
                      {v.name}
                    </span>
                  ))}
                </div>
              )}
              {(extractions.vendors_replacing?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-outsail-gray-600 mb-1">Replacing:</p>
                  {extractions.vendors_replacing!.map((v, i) => (
                    <span
                      key={i}
                      className="inline-block text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full mr-1 mb-1"
                    >
                      {v.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {(extractions.complexity_signals?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-2">
                Complexity Flags
              </p>
              <ul className="space-y-1.5">
                {extractions.complexity_signals!.map((cs, i) => (
                  <li key={i} className="flex gap-2 text-xs text-outsail-slate">
                    <SeverityDot severity={cs.severity} />
                    <span>
                      <span className="font-medium">{cs.area}:</span> {cs.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {extractions.project_params?.go_live_date && (
            <div>
              <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-1">
                Timeline
              </p>
              <p className="text-xs text-outsail-slate">{extractions.project_params.go_live_date}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Completeness panel (deep_discovery) ───────────────────────────────────

function CompletenessPanel({
  sections,
  topicsCovered,
  isOpen,
  onToggle,
}: {
  sections: Array<{ key: string; name: string }>
  topicsCovered: string[]
  isOpen: boolean
  onToggle: () => void
}) {
  const coveredCount = sections.filter((s) =>
    topicsCovered.some((t) => t.toLowerCase() === s.name.toLowerCase() || t.toLowerCase() === s.key.toLowerCase())
  ).length

  return (
    <div
      className={cn(
        'flex flex-col border-l border-outsail-gray-200 bg-white transition-all duration-200 flex-shrink-0',
        isOpen ? 'w-72' : 'w-10'
      )}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-b border-outsail-gray-200 text-outsail-gray-600 hover:text-outsail-navy transition-colors flex-shrink-0"
        title={isOpen ? 'Collapse panel' : 'Section coverage'}
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-label font-semibold text-outsail-navy">Section Coverage</p>
            <span className="text-xs text-outsail-gray-600">{coveredCount}/{sections.length}</span>
          </div>

          {sections.length === 0 ? (
            <p className="text-xs text-outsail-gray-600 italic">No sections defined yet.</p>
          ) : (
            <ul className="space-y-2">
              {sections.map((s) => {
                const covered = topicsCovered.some(
                  (t) => t.toLowerCase() === s.name.toLowerCase() || t.toLowerCase() === s.key.toLowerCase()
                )
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    {covered ? (
                      <CheckCircle2 className="w-4 h-4 text-outsail-teal flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-outsail-gray-200 flex-shrink-0" />
                    )}
                    <span className={cn('text-xs', covered ? 'text-outsail-teal font-medium' : 'text-outsail-gray-600')}>
                      {s.name}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {coveredCount === sections.length && sections.length > 0 && (
            <div className="p-2 bg-outsail-teal-light rounded-lg">
              <p className="text-xs text-outsail-teal font-medium">All sections covered! You can wrap up when ready.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function BlueprintChat({
  sessionType,
  projectId,
  sessionId,
  participant,
  focusAreas,
  recommendedSections,
  reopenNote,
  onComplete,
  onDone,
  initialMessages = [],
}: BlueprintChatProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<BlueprintChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingOpening, setIsLoadingOpening] = useState(initialMessages.length === 0)
  const [extractions, setExtractions] = useState<Extractions>({})
  const [topicsCovered, setTopicsCovered] = useState<string[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isDoneLoading, setIsDoneLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasFetchedOpening = useRef(false)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Stream a request to the chat API
  const streamChat = useCallback(
    async (userMessage?: string) => {
      const tempAssistantId = createId()

      if (userMessage) {
        setMessages((prev) => [
          ...prev,
          { id: createId(), role: 'user', content: userMessage },
          { id: tempAssistantId, role: 'assistant', content: '', isStreaming: true },
        ])
      } else {
        // Opening message
        setMessages((prev) => [
          ...prev,
          { id: tempAssistantId, role: 'assistant', content: '', isStreaming: true },
        ])
      }

      setIsStreaming(true)
      setError(null)

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            projectId,
            sessionType,
            message: userMessage,
            focusAreas,
          }),
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body!.getReader()
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
            const dataStr = line.slice(6).trim()
            if (!dataStr) continue

            try {
              const event = JSON.parse(dataStr) as {
                type: string
                text?: string
                data?: Extractions
                message?: string
              }

              switch (event.type) {
                case 'delta':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === tempAssistantId
                        ? { ...m, content: m.content + (event.text ?? '') }
                        : m
                    )
                  )
                  break

                case 'extractions':
                  if (event.data) {
                    setExtractions((prev) => ({ ...prev, ...event.data }))
                    if (event.data.topics_covered) {
                      setTopicsCovered(event.data.topics_covered)
                    }
                  }
                  break

                case 'session_complete':
                  setIsCompleting(true)
                  break

                case 'done':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === tempAssistantId ? { ...m, isStreaming: false } : m
                    )
                  )
                  setIsStreaming(false)

                  if (isCompleting) {
                    await handleSessionComplete()
                  }
                  break

                case 'error':
                  throw new Error(event.message ?? 'Stream error')
              }
            } catch { /* skip malformed events */ }
          }
        }
      } catch (err) {
        console.error('[BlueprintChat] Stream error:', err)
        setError('Something went wrong. Please try again.')
        setMessages((prev) => prev.filter((m) => m.id !== tempAssistantId))
        setIsStreaming(false)
      } finally {
        setIsLoadingOpening(false)
      }
    },
    [sessionId, projectId, sessionType, focusAreas, isCompleting]
  )

  // Fetch opening message on mount if no history
  useEffect(() => {
    if (initialMessages.length === 0 && !hasFetchedOpening.current) {
      hasFetchedOpening.current = true
      void streamChat(undefined)
    } else {
      setIsLoadingOpening(false)
    }
  }, []) // Only on mount — streamChat intentionally excluded

  // Handle session completion → call determine-blueprint-structure
  const handleSessionComplete = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/determine-blueprint-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, projectId }),
      })

      if (!res.ok) throw new Error('Failed to generate structure')

      onComplete?.()
      router.push('/workspace/intake/summary')
    } catch (err) {
      console.error('[BlueprintChat] Completion error:', err)
      // Still navigate — user can try summary page
      router.push('/workspace/intake/summary')
    }
  }, [sessionId, projectId, onComplete, router])

  // Detect session_complete from streaming (re-check after streaming ends)
  useEffect(() => {
    if (isCompleting && !isStreaming) {
      void handleSessionComplete()
    }
  }, [isCompleting, isStreaming, handleSessionComplete])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await streamChat(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const showTopicProgress = sessionType === 'discovery'
  const isDeepDiscovery = sessionType === 'deep_discovery'

  async function handleDone() {
    if (!onDone) return
    setIsDoneLoading(true)
    try {
      await onDone()
    } finally {
      setIsDoneLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[520px]">
      {/* ── Reopen note banner ─────────────────────────────────────────── */}
      {reopenNote && (
        <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-card">
          <p className="text-xs font-semibold text-amber-800 mb-0.5">Note from your advisor:</p>
          <p className="text-sm text-amber-700">{reopenNote}</p>
        </div>
      )}

      {/* ── "I'm done" bar (deep_discovery only) ──────────────────────── */}
      {isDeepDiscovery && onDone && (
        <div className="flex items-center justify-between px-4 py-2.5 mb-3 bg-outsail-teal-light rounded-card border border-outsail-teal/20">
          <p className="text-sm text-outsail-teal-dark font-medium">Ready to hand off to your advisor?</p>
          <button
            onClick={() => void handleDone()}
            disabled={isDoneLoading || isStreaming}
            className="flex items-center gap-2 px-4 py-1.5 bg-outsail-teal text-white text-sm font-medium rounded-lg hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {isDoneLoading ? 'Finishing up…' : "I'm done — ready for review"}
          </button>
        </div>
      )}

    <div className="flex flex-1 rounded-card border border-outsail-gray-200 overflow-hidden bg-white min-h-0">
      {/* ── Chat area ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topic progress (discovery only) */}
        {showTopicProgress && (
          <div className="flex items-center gap-4 px-5 py-3 border-b border-outsail-gray-200 bg-outsail-gray-50">
            <span className="text-xs text-outsail-gray-600 font-medium">Progress:</span>
            {DISCOVERY_TOPICS.map((topic) => {
              const covered = topicsCovered.includes(topic.key)
              return (
                <div key={topic.key} className="flex items-center gap-1.5">
                  {covered ? (
                    <CheckCircle2 className="w-4 h-4 text-outsail-teal flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-outsail-gray-200 flex-shrink-0" />
                  )}
                  <span
                    className={cn('text-xs font-medium', covered ? 'text-outsail-teal' : 'text-outsail-gray-600')}
                  >
                    {topic.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {isLoadingOpening && (
            <div className="flex items-start gap-3">
              <OutSailAvatar />
              <div className="bg-outsail-gray-50 border border-outsail-gray-200 rounded-card rounded-tl-sm px-4 py-3">
                <TypingIndicator />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isCompleting && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-sm text-outsail-gray-600 bg-outsail-teal-light px-4 py-2 rounded-full">
                <svg className="animate-spin w-4 h-4 text-outsail-teal" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating your Blueprint structure…
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="text-sm text-outsail-red bg-red-50 px-4 py-2 rounded-full">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-outsail-gray-200 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={isCompleting ? 'Wrapping up…' : 'Type your message…'}
              disabled={isStreaming || isCompleting}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-outsail-gray-200 px-3 py-2.5 text-sm text-outsail-slate placeholder-outsail-gray-600 focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '40px', maxHeight: '160px' }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming || isCompleting}
              className="flex-shrink-0 w-10 h-10 rounded-lg bg-outsail-teal text-white flex items-center justify-center hover:bg-outsail-teal-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-outsail-gray-600 mt-1.5 px-1">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ── Extraction panel (discovery) / Completeness panel (deep_discovery) ── */}
      {isDeepDiscovery && recommendedSections ? (
        <CompletenessPanel
          sections={recommendedSections}
          topicsCovered={topicsCovered}
          isOpen={isPanelOpen}
          onToggle={() => setIsPanelOpen((v) => !v)}
        />
      ) : (
        <ExtractionPanel
          extractions={extractions}
          topicsCovered={topicsCovered}
          isOpen={isPanelOpen}
          onToggle={() => setIsPanelOpen((v) => !v)}
        />
      )}
    </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function OutSailAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-outsail-teal flex items-center justify-center flex-shrink-0 mt-0.5">
      <span className="text-white font-bold text-xs">OS</span>
    </div>
  )
}

function MessageBubble({ message }: { message: BlueprintChatMessage }) {
  const isAssistant = message.role === 'assistant'

  if (isAssistant) {
    return (
      <div className="flex items-start gap-3 animate-fade-in">
        <OutSailAvatar />
        <div className="flex-1 min-w-0">
          <div className="bg-outsail-gray-50 border border-outsail-gray-200 rounded-card rounded-tl-sm px-4 py-3">
            {message.isStreaming && !message.content ? (
              <TypingIndicator />
            ) : (
              <p className="text-sm text-outsail-slate whitespace-pre-wrap leading-relaxed">
                {message.content}
                {message.isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-outsail-teal ml-0.5 animate-pulse align-middle" />
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end animate-fade-in">
      <div className="max-w-[75%] bg-outsail-navy rounded-card rounded-tr-sm px-4 py-3">
        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}

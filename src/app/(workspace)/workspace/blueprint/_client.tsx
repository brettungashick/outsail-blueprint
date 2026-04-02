'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  MessageSquare,
  Send,
  AlertTriangle,
  CornerDownRight,
  Clock,
} from 'lucide-react'
import type { SectionDepth, SectionStatus } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────

interface Section {
  id: string
  section_name: string
  section_key: string
  depth: SectionDepth
  status: SectionStatus
  ai_narrative_current: string | null
  ai_narrative_future: string | null
}

interface Comment {
  id: string
  content: string
  parent_comment_id: string | null
  user_id: string
  user_name: string | null
  user_email: string | null
  user_role: string | null
  created_at: string | null
}

interface ClientBlueprintProps {
  projectId: string
  sections: Section[]
  currentUserId: string
  currentUserName: string | null
  currentUserRole: string
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

function formatTime(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function initials(name: string | null, email: string | null): string {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

// ── CommentThread ──────────────────────────────────────────────────────────

function CommentThread({
  projectId,
  sectionId,
  comments,
  onCommentAdded,
}: {
  projectId: string
  sectionId: string
  comments: Comment[]
  onCommentAdded: (c: Comment) => void
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const topLevel = comments.filter((c) => !c.parent_comment_id)
  const replies = (parentId: string) => comments.filter((c) => c.parent_comment_id === parentId)

  async function submit(content: string, parentId?: string) {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/sections/${sectionId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), parent_comment_id: parentId }),
      })
      if (!res.ok) return
      const data = await res.json() as { comment: Comment }
      onCommentAdded(data.comment)
      if (parentId) {
        setReplyText((p) => ({ ...p, [parentId]: '' }))
        setReplyTo(null)
      } else {
        setText('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function CommentBubble({ c, indent = false }: { c: Comment; indent?: boolean }) {
    const role = c.user_role === 'advisor' || c.user_role === 'admin' ? 'Advisor' : 'You'
    const avatarBg = c.user_role === 'advisor' || c.user_role === 'admin' ? 'bg-outsail-purple' : 'bg-outsail-teal'
    return (
      <div className={`flex gap-2.5 ${indent ? 'ml-8' : ''}`}>
        <div className={`w-7 h-7 rounded-full ${avatarBg} text-white text-xs font-semibold flex items-center justify-center flex-shrink-0`}>
          {initials(c.user_name, c.user_email)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-semibold text-outsail-navy">{c.user_name ?? c.user_email ?? role}</span>
            <span className="text-[10px] text-outsail-gray-600">{role}</span>
            <span className="text-[10px] text-outsail-gray-600 ml-auto">{formatTime(c.created_at)}</span>
          </div>
          <p className="text-sm text-outsail-slate leading-relaxed">{c.content}</p>
          <button
            onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
            className="mt-1 text-xs text-outsail-gray-600 hover:text-outsail-teal transition-colors flex items-center gap-1"
          >
            <CornerDownRight className="w-3 h-3" /> Reply
          </button>
          {replyTo === c.id && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyText[c.id] ?? ''}
                onChange={(e) => setReplyText((p) => ({ ...p, [c.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(replyText[c.id] ?? '', c.id) } }}
                placeholder="Write a reply…"
                className="flex-1 text-xs border border-outsail-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-outsail-teal"
              />
              <button
                onClick={() => void submit(replyText[c.id] ?? '', c.id)}
                disabled={submitting || !(replyText[c.id] ?? '').trim()}
                className="px-3 py-1.5 bg-outsail-teal text-white text-xs rounded-lg disabled:opacity-40"
              >
                {submitting ? <Spinner className="w-3 h-3" /> : 'Reply'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 border-t border-outsail-gray-200 pt-4 mt-4">
      <p className="text-xs font-semibold text-outsail-navy uppercase tracking-wide flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        Comments {comments.length > 0 && `(${comments.length})`}
      </p>

      {topLevel.length === 0 && (
        <p className="text-xs text-outsail-gray-600 italic">No comments yet. Add one below.</p>
      )}

      <div className="space-y-4">
        {topLevel.map((c) => (
          <div key={c.id} className="space-y-3">
            <CommentBubble c={c} />
            {replies(c.id).map((r) => (
              <CommentBubble key={r.id} c={r} indent />
            ))}
          </div>
        ))}
      </div>

      {/* New comment input */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(text) } }}
          placeholder="Add a comment or question…"
          className="flex-1 text-sm border border-outsail-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-outsail-teal"
        />
        <button
          onClick={() => void submit(text)}
          disabled={submitting || !text.trim()}
          className="px-3 py-2 bg-outsail-teal text-white text-sm rounded-lg disabled:opacity-40 flex items-center gap-1.5"
        >
          {submitting ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Section Review Card ────────────────────────────────────────────────────

function SectionCard({
  section,
  projectId,
  approved,
  onApprove,
  onRequestChanges,
}: {
  section: Section
  projectId: string
  approved: boolean
  onApprove: () => void
  onRequestChanges: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [approving, setApproving] = useState(false)
  const [requestingChanges, setRequestingChanges] = useState(false)
  const [changeText, setChangeText] = useState('')
  const [showChangeInput, setShowChangeInput] = useState(false)
  const hasContent = section.ai_narrative_current || section.ai_narrative_future

  const loadComments = useCallback(async () => {
    if (loadingComments) return
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/sections/${section.id}/comments`)
      if (res.ok) {
        const data = await res.json() as { comments: Comment[] }
        setComments(data.comments)
      }
    } finally {
      setLoadingComments(false)
    }
  }, [projectId, section.id, loadingComments])

  useEffect(() => {
    if (expanded && comments.length === 0) void loadComments()
  }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleApprove() {
    setApproving(true)
    try {
      await fetch(`/api/projects/${projectId}/sections/${section.id}/approve`, { method: 'POST' })
      onApprove()
    } finally {
      setApproving(false)
    }
  }

  async function handleRequestChanges() {
    if (!changeText.trim()) { setShowChangeInput(true); return }
    setRequestingChanges(true)
    try {
      // Add comment flagging the issue
      const res = await fetch(`/api/projects/${projectId}/sections/${section.id}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: `[Changes Requested] ${changeText.trim()}` }),
      })
      if (res.ok) {
        const data = await res.json() as { comment: Comment }
        setComments((p) => [...p, data.comment])
        setChangeText('')
        setShowChangeInput(false)
        onRequestChanges()
      }
    } finally {
      setRequestingChanges(false)
    }
  }

  return (
    <div className={`outsail-card p-0 overflow-hidden border-2 transition-colors ${
      approved ? 'border-outsail-teal/30' : 'border-outsail-gray-200'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-outsail-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-outsail-gray-600 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-outsail-gray-600 flex-shrink-0" />
          }
          <span className="font-semibold text-outsail-navy truncate">{section.section_name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {!hasContent && (
            <span className="text-xs text-outsail-gray-600 italic">Pending content</span>
          )}
          {approved ? (
            <span className="flex items-center gap-1 text-xs font-medium text-outsail-teal bg-outsail-teal-light px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Approved
            </span>
          ) : (
            <span className="text-xs text-outsail-gray-600 px-2 py-0.5 rounded-full bg-outsail-gray-50 border border-outsail-gray-200">
              Pending Review
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-outsail-gray-200">
          {!hasContent ? (
            <div className="p-5 text-center py-8">
              <Clock className="w-8 h-8 text-outsail-gray-200 mx-auto mb-2" />
              <p className="text-sm text-outsail-gray-600">Content for this section is being prepared by your advisor.</p>
            </div>
          ) : (
            <>
              {/* Two-column narratives */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-outsail-gray-200">
                <div className="p-5">
                  <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-3">Current State</p>
                  <div className="text-sm text-outsail-slate leading-relaxed whitespace-pre-wrap">
                    {section.ai_narrative_current}
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold text-outsail-gray-600 uppercase tracking-wide mb-3">Future State</p>
                  <div className="text-sm text-outsail-slate leading-relaxed whitespace-pre-wrap">
                    {section.ai_narrative_future}
                  </div>
                </div>
              </div>

              {/* Approval actions */}
              {!approved && (
                <div className="px-5 py-4 bg-outsail-gray-50 border-t border-outsail-gray-200">
                  {showChangeInput ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-outsail-navy">Describe what needs to change:</p>
                      <textarea
                        value={changeText}
                        onChange={(e) => setChangeText(e.target.value)}
                        rows={3}
                        placeholder="Be specific — e.g. 'The payroll frequency is wrong, we run bi-weekly not monthly.'"
                        className="w-full text-sm border border-outsail-gray-200 rounded-lg p-3 focus:outline-none focus:border-outsail-teal resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => void handleRequestChanges()}
                          disabled={requestingChanges || !changeText.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-outsail-coral text-white text-sm font-medium rounded-lg disabled:opacity-50"
                        >
                          {requestingChanges ? <Spinner className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          Submit Request
                        </button>
                        <button
                          onClick={() => { setShowChangeInput(false); setChangeText('') }}
                          className="text-sm text-outsail-gray-600 hover:text-outsail-navy"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => void handleApprove()}
                        disabled={approving}
                        className="flex items-center gap-2 px-4 py-2 bg-outsail-teal text-white text-sm font-medium rounded-lg hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors"
                      >
                        {approving ? <Spinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        Approve Section
                      </button>
                      <button
                        onClick={() => setShowChangeInput(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-outsail-coral text-outsail-coral text-sm font-medium rounded-lg hover:bg-outsail-coral/5 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Comment thread */}
          <div className="px-5 pb-5">
            {loadingComments ? (
              <div className="flex items-center gap-2 py-4 text-sm text-outsail-gray-600">
                <Spinner className="w-4 h-4" /> Loading comments…
              </div>
            ) : (
              <CommentThread
                projectId={projectId}
                sectionId={section.id}
                comments={comments}
                onCommentAdded={(c) => setComments((p) => [...p, c])}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function ClientBlueprint({ projectId, sections: initialSections, currentUserId, currentUserName, currentUserRole }: ClientBlueprintProps) {
  const [sections, setSections] = useState(initialSections)
  const [approvedIds, setApprovedIds] = useState<Set<string>>(
    new Set(initialSections.filter((s) => s.status === 'client_approved' || s.status === 'complete').map((s) => s.id))
  )
  const [allApproved, setAllApproved] = useState(false)

  const approvedCount = approvedIds.size
  const totalCount = sections.length

  function handleApprove(sectionId: string) {
    setApprovedIds((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      if (next.size === sections.length) setAllApproved(true)
      return next
    })
  }

  function handleRequestChanges(sectionId: string) {
    // Section stays in review — no state change needed
    // The comment already logged it
  }

  if (sections.length === 0) {
    return (
      <div className="outsail-card py-16 text-center">
        <Clock className="w-8 h-8 text-outsail-gray-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-outsail-navy mb-1">Blueprint sections are being prepared</p>
        <p className="text-sm text-outsail-gray-600">Your advisor is finishing up the Blueprint. Check back soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="outsail-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-header-sm text-outsail-navy">Blueprint Review</h3>
            <p className="text-xs text-outsail-gray-600 mt-0.5">Review each section, add comments, and approve when ready.</p>
          </div>
          <span className="text-sm font-semibold text-outsail-navy">
            {approvedCount} / {totalCount} approved
          </span>
        </div>
        <div className="w-full bg-outsail-gray-200 rounded-full h-2">
          <div
            className="bg-outsail-teal h-2 rounded-full transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(approvedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* All approved banner */}
      {allApproved && (
        <div className="rounded-card bg-outsail-teal-light border border-outsail-teal/20 p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-outsail-teal flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-outsail-teal-dark">All sections approved!</p>
            <p className="text-xs text-outsail-teal-dark/70 mt-0.5">Your advisor has been notified and will generate your deliverables.</p>
          </div>
        </div>
      )}

      {/* Section cards */}
      <div className="space-y-3">
        {sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            projectId={projectId}
            approved={approvedIds.has(section.id)}
            onApprove={() => handleApprove(section.id)}
            onRequestChanges={() => handleRequestChanges(section.id)}
          />
        ))}
      </div>
    </div>
  )
}

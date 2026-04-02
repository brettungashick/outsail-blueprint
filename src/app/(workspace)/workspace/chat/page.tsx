'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BlueprintChat } from '@/components/chat/blueprint-chat'
import type { BlueprintChatMessage } from '@/components/chat/blueprint-chat'

interface ProjectData {
  id: string
  client_company_name: string
  self_service_enabled: boolean
  recommended_sections: string | null
  reopen_notes: string | null
}

interface SessionData {
  id: string
  status: string
  participant_name: string | null
}

interface User {
  name: string | null
  email: string
  role: string
}

export default function DeepDiscoveryChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [session, setSession] = useState<SessionData | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [initialMessages, setInitialMessages] = useState<BlueprintChatMessage[]>([])

  useEffect(() => {
    async function load() {
      try {
        // Load user + project data
        const res = await fetch('/api/workspace/chat-init')
        if (res.status === 401 || res.status === 403) {
          router.replace('/login')
          return
        }
        if (res.status === 404) {
          setError('No project found for your account.')
          setLoading(false)
          return
        }
        if (!res.ok) {
          setError('Failed to load. Please try again.')
          setLoading(false)
          return
        }

        const data = await res.json() as {
          project: ProjectData
          session: SessionData
          user: User
          messages: BlueprintChatMessage[]
          redirectTo?: string
        }

        if (data.redirectTo) {
          router.replace(data.redirectTo)
          return
        }

        setProject(data.project)
        setSession(data.session)
        setUser(data.user)
        setInitialMessages(data.messages)
      } catch {
        setError('Failed to load. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [router])

  const handleDone = useCallback(async () => {
    if (!session || !project) return
    await fetch('/api/workspace/complete-discovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, project_id: project.id }),
    })
    router.push('/workspace')
  }, [session, project, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-outsail-gray-600">Loading your session…</p>
      </div>
    )
  }

  if (error || !project || !session || !user) {
    return (
      <div className="outsail-card py-12 text-center">
        <p className="text-sm text-outsail-gray-600">{error ?? 'Unable to load your session.'}</p>
      </div>
    )
  }

  // Parse recommended sections for completeness panel
  const recommendedSections: Array<{ key: string; name: string }> = []
  if (project.recommended_sections) {
    try {
      const rs = JSON.parse(project.recommended_sections) as Array<{ key?: string; name?: string; title?: string }>
      for (const s of rs) {
        const key = s.key ?? ''
        const name = s.name ?? s.title ?? key
        if (name) recommendedSections.push({ key, name })
      }
    } catch { /* skip */ }
  }

  const participant = {
    name: user.name ?? user.email,
    role: user.role,
    email: user.email,
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-header-lg text-outsail-navy">Blueprint Assistant</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          A deep discovery session to capture your detailed requirements. Take your time — there&apos;s no time limit.
        </p>
      </div>

      <BlueprintChat
        sessionType="deep_discovery"
        projectId={project.id}
        sessionId={session.id}
        participant={participant}
        recommendedSections={recommendedSections.length ? recommendedSections : undefined}
        reopenNote={project.reopen_notes}
        onDone={handleDone}
        initialMessages={initialMessages}
      />
    </div>
  )
}

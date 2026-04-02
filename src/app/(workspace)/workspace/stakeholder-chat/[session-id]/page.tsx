import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions, chatMessages, users } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { BlueprintChat } from '@/components/chat/blueprint-chat'
import type { BlueprintChatMessage } from '@/components/chat/blueprint-chat'
import { StakeholderDoneButton } from './_done-button'

export const dynamic = 'force-dynamic'

export default async function StakeholderChatPage({
  params,
}: {
  params: { 'session-id': string }
}) {
  const sessionParamId = params['session-id']

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) redirect('/login')

  // Load the discovery session
  const discoverySession = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionParamId))
    .get()

  if (!discoverySession) redirect('/workspace')
  if (discoverySession.session_type !== 'deep_discovery') redirect('/workspace')

  // Verify the current user is a member of the project
  const memberCheck = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .all()

  const hasAccess = memberCheck.some((m) => m.project_id === discoverySession.project_id)
  if (!hasAccess) redirect('/workspace')

  // Load project
  const project = await db
    .select({
      id: projects.id,
      client_company_name: projects.client_company_name,
      recommended_sections: projects.recommended_sections,
      reopen_notes: projects.reopen_notes,
    })
    .from(projects)
    .where(eq(projects.id, discoverySession.project_id))
    .get()

  if (!project) redirect('/workspace')

  // Load user info
  const user = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, authSession.userId))
    .get()

  // Load existing messages
  const rawMessages = await db
    .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionParamId))
    .orderBy(asc(chatMessages.created_at))
    .all()

  const initialMessages: BlueprintChatMessage[] = rawMessages.map((m) => ({
    id: m.id,
    role: m.role as 'assistant' | 'user',
    content: m.content,
  }))

  // Parse recommended sections
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

  // Parse focus areas
  const focusAreas: string[] = discoverySession.focus_areas
    ? (() => { try { return JSON.parse(discoverySession.focus_areas) as string[] } catch { return [] } })()
    : []

  const participant = {
    name: discoverySession.participant_name ?? user?.name ?? authSession.email,
    role: discoverySession.participant_role ?? 'stakeholder',
    email: discoverySession.participant_email ?? user?.email ?? authSession.email,
  }

  const isCompleted = discoverySession.status === 'completed'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-header-lg text-outsail-navy">
          {project.client_company_name} — Discovery Session
        </h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          {discoverySession.participant_role
            ? `Welcome, ${participant.name}. As ${discoverySession.participant_role}, share what you know about ${focusAreas.length ? focusAreas.join(', ') : 'your area'}.`
            : `Welcome to your discovery session. Share as much detail as you can — there's no time limit.`}
        </p>
      </div>

      {isCompleted ? (
        <div className="outsail-card py-12 text-center">
          <p className="text-base font-semibold text-outsail-navy mb-2">Session Complete</p>
          <p className="text-sm text-outsail-gray-600">
            Thank you for your input! Your advisor has been notified and will incorporate your responses into the Blueprint.
          </p>
        </div>
      ) : (
        <BlueprintChat
          sessionType="deep_discovery"
          projectId={project.id}
          sessionId={sessionParamId}
          participant={participant}
          focusAreas={focusAreas.length ? focusAreas : undefined}
          recommendedSections={recommendedSections.length ? recommendedSections : undefined}
          reopenNote={project.reopen_notes}
          onDone={undefined}
          initialMessages={initialMessages}
        />
      )}

      {!isCompleted && (
        <StakeholderDoneButton
          sessionId={sessionParamId}
          projectId={project.id}
        />
      )}
    </div>
  )
}

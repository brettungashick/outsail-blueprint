import { NextResponse } from 'next/server'
import { eq, asc, desc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions, chatMessages, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the user's project via membership
  const membership = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .get()

  if (!membership) return NextResponse.json({ error: 'No project found' }, { status: 404 })

  const project = await db
    .select({
      id: projects.id,
      client_company_name: projects.client_company_name,
      status: projects.status,
      self_service_enabled: projects.self_service_enabled,
      recommended_sections: projects.recommended_sections,
      reopen_notes: projects.reopen_notes,
    })
    .from(projects)
    .where(eq(projects.id, membership.project_id))
    .get()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // If self-service not enabled, redirect to workspace
  if (!project.self_service_enabled) {
    return NextResponse.json({ redirectTo: '/workspace' })
  }

  // Get user info
  const user = await db
    .select({ name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, authSession.userId))
    .get()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Find or create a deep_discovery session for this user on this project
  const existingSessions = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.project_id, project.id))
    .orderBy(desc(discoverySessions.created_at))
    .all()

  // Look for an active or existing self-service deep_discovery session created by this user
  // (not a stakeholder session — those have participant_email set and were created by advisors)
  let deepSession = existingSessions.find(
    (s) => s.session_type === 'deep_discovery' && s.created_by === authSession.userId && !s.participant_email
  )

  // If completed session exists but advisor added reopen_notes, create a new one
  if (deepSession?.status === 'completed' && project.reopen_notes) {
    deepSession = undefined
  }

  let sessionId: string
  if (!deepSession) {
    sessionId = createId()
    await db.insert(discoverySessions).values({
      id: sessionId,
      project_id: project.id,
      session_type: 'deep_discovery',
      status: 'active',
      created_by: authSession.userId,
    })
  } else {
    sessionId = deepSession.id
  }

  // Load existing messages
  const rawMessages = await db
    .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionId))
    .orderBy(asc(chatMessages.created_at))
    .all()

  const messages = rawMessages.map((m) => ({
    id: m.id,
    role: m.role as 'assistant' | 'user',
    content: m.content,
  }))

  return NextResponse.json({
    project: {
      id: project.id,
      client_company_name: project.client_company_name,
      self_service_enabled: project.self_service_enabled,
      recommended_sections: project.recommended_sections,
      reopen_notes: project.reopen_notes,
    },
    session: {
      id: sessionId,
      status: deepSession?.status ?? 'active',
      participant_name: null,
    },
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    messages,
  })
}

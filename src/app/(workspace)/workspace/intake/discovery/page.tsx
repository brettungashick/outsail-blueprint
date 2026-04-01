import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions, chatMessages, users } from '@/lib/db/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { IntakeStepper } from '@/components/workspace/intake-stepper'
import { BlueprintChat } from '@/components/chat/blueprint-chat'
import type { BlueprintChatMessage } from '@/components/chat/blueprint-chat'

export const dynamic = 'force-dynamic'

const INTAKE_STEPS = ['Company Profile', 'Tech Stack', 'Discovery Chat', 'Summary Review']

export default async function DiscoveryPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) redirect('/login')

  // Find the client's project
  const memberships = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .all()

  const projectIds = memberships.map((m) => m.project_id)
  if (projectIds.length === 0) {
    return <NoProjectView />
  }

  const projectRows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updated_at))
    .all()

  const project = projectRows.find((r) => projectIds.includes(r.id))
  if (!project) {
    return <NoProjectView />
  }

  // If summary already approved, redirect to summary
  if (project.status === 'summary_approved' || project.status === 'deep_discovery' ||
      project.status === 'blueprint_generation' || project.status === 'client_review' ||
      project.status === 'approved' || project.status === 'outputs') {
    redirect('/workspace/intake/summary')
  }

  // Get the user's display info
  const userRecord = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, authSession.userId))
    .get()

  const participant = {
    name: userRecord?.name ?? authSession.email,
    role: 'client',
    email: userRecord?.email ?? authSession.email,
  }

  // Check for existing discovery session
  const existingSessions = await db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.project_id, project.id))
    .orderBy(desc(discoverySessions.created_at))
    .all()

  const discoverySession = existingSessions.find((s) => s.session_type === 'discovery')

  // If completed session exists, redirect to summary
  if (discoverySession?.status === 'completed' && project.status === 'discovery_complete') {
    redirect('/workspace/intake/summary')
  }

  // Create session if it doesn't exist
  let sessionId: string
  if (!discoverySession) {
    sessionId = createId()
    await db.insert(discoverySessions).values({
      id: sessionId,
      project_id: project.id,
      session_type: 'discovery',
      status: 'active',
      created_by: authSession.userId,
    })
  } else {
    sessionId = discoverySession.id
  }

  // Load existing message history for this session
  const rawMessages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
    })
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionId))
    .orderBy(asc(chatMessages.created_at))
    .all()

  const initialMessages: BlueprintChatMessage[] = rawMessages.map((m) => ({
    id: m.id,
    role: m.role as 'assistant' | 'user',
    content: m.content,
  }))

  return (
    <div className="space-y-6">
      <IntakeStepper currentStep={3} steps={INTAKE_STEPS} />

      <div>
        <h1 className="text-header-lg text-outsail-navy">Discovery Chat</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          A quick conversation to understand your priorities, vendors, and any complexities — takes about 5–10 minutes.
        </p>
      </div>

      <BlueprintChat
        sessionType="discovery"
        projectId={project.id}
        sessionId={sessionId}
        participant={participant}
        initialMessages={initialMessages}
      />
    </div>
  )
}

function NoProjectView() {
  return (
    <div className="space-y-8">
      <IntakeStepper currentStep={3} steps={INTAKE_STEPS} />
      <div className="outsail-card text-center py-12">
        <p className="text-body text-outsail-gray-600">
          No project found. Your advisor will set up your workspace shortly.
        </p>
      </div>
    </div>
  )
}

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections, users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ClientBlueprint } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Blueprint Review',
}

export default async function WorkspaceBlueprintPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Find this client's project
  const memberships = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, session.userId))
    .all()

  const projectIds = memberships.map((m) => m.project_id)
  let project: { id: string; status: string; client_company_name: string } | null = null

  if (projectIds.length > 0) {
    const rows = await db
      .select({ id: projects.id, status: projects.status, client_company_name: projects.client_company_name })
      .from(projects)
      .orderBy(desc(projects.updated_at))
      .all()
    project = rows.find((r) => projectIds.includes(r.id)) ?? null
  }

  // If not in client_review or approved, redirect to workspace
  if (!project || !['client_review', 'approved'].includes(project.status)) {
    redirect('/workspace')
  }

  // Load sections with narratives
  const sections = await db
    .select({
      id: blueprintSections.id,
      section_name: blueprintSections.section_name,
      section_key: blueprintSections.section_key,
      depth: blueprintSections.depth,
      status: blueprintSections.status,
      ai_narrative_current: blueprintSections.ai_narrative_current,
      ai_narrative_future: blueprintSections.ai_narrative_future,
    })
    .from(blueprintSections)
    .where(eq(blueprintSections.project_id, project.id))
    .all()

  // Get current user info
  const user = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.userId))
    .get()

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-header-lg text-outsail-navy">{project.client_company_name} Blueprint</h1>
        <p className="text-sm text-outsail-gray-600 mt-1">
          Review each section below. You can add comments, request changes, or approve when you&apos;re satisfied.
        </p>
      </div>

      <ClientBlueprint
        projectId={project.id}
        sections={sections as Parameters<typeof ClientBlueprint>[0]['sections']}
        currentUserId={session.userId}
        currentUserName={user?.name ?? null}
        currentUserRole={session.role}
      />
    </div>
  )
}

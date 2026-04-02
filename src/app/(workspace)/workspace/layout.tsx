import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, projects, projectMembers, techStackSystems } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar'
import { getLogoUrl } from '@/lib/db/app-settings'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  let userEmail = session.email
  let userName: string | undefined
  let companyName: string | undefined
  let techStackComplete = false
  let selfServiceEnabled = false
  let projectStatus: string | undefined

  try {
    const user = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()

    if (user) {
      userEmail = user.email
      userName = user.name ?? undefined
    }

    // Find the client's first project for the company name + tech stack check
    const membership = await db
      .select({ project_id: projectMembers.project_id })
      .from(projectMembers)
      .where(eq(projectMembers.user_id, session.userId))
      .get()

    if (membership) {
      const project = await db
        .select({ client_company_name: projects.client_company_name, self_service_enabled: projects.self_service_enabled, status: projects.status })
        .from(projects)
        .where(eq(projects.id, membership.project_id))
        .get()

      companyName = project?.client_company_name ?? undefined
      selfServiceEnabled = project?.self_service_enabled ?? false
      projectStatus = project?.status ?? undefined

      // Tech stack is complete if there's at least one primary system
      const primarySystem = await db
        .select({ id: techStackSystems.id })
        .from(techStackSystems)
        .where(
          and(
            eq(techStackSystems.project_id, membership.project_id),
            eq(techStackSystems.is_primary, true)
          )
        )
        .get()

      techStackComplete = !!primarySystem
    }
  } catch {
    // Non-fatal
  }

  const logoUrl = await getLogoUrl()

  return (
    <div className="flex h-screen overflow-hidden bg-outsail-gray-50">
      <WorkspaceSidebar
        userEmail={userEmail}
        userName={userName}
        companyName={companyName}
        techStackComplete={techStackComplete}
        selfServiceEnabled={selfServiceEnabled}
        projectStatus={projectStatus}
        logoUrl={logoUrl ?? undefined}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-content mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}

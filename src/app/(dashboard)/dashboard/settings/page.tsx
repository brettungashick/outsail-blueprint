import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, projects, projectMembers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { SettingsClient } from './_settings-client'
import { getLogoUrl } from '@/lib/db/app-settings'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings',
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export default async function SettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  let currentUser: { email: string; name: string | null; role: string } | undefined

  try {
    const dbUser = await db
      .select({ email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()
    currentUser = dbUser ?? undefined
  } catch {
    // Non-fatal
  }

  const displayEmail = currentUser?.email ?? session.email
  const displayName = currentUser?.name ?? displayEmail.split('@')[0]
  const displayRole = currentUser?.role ?? session.role
  const initials = getInitials(currentUser?.name, displayEmail)

  // Fetch all users for admin
  let allUsers: Array<{
    id: string
    email: string
    name: string | null
    role: string
    must_change_password: boolean | null
    is_active: boolean | null
    created_at: string | null
  }> = []

  if (displayRole === 'admin') {
    try {
      allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          must_change_password: users.must_change_password,
          is_active: users.is_active,
          created_at: users.created_at,
        })
        .from(users)
        .orderBy(desc(users.created_at))
        .all() as typeof allUsers
    } catch {
      // Non-fatal
    }
  }

  // Fetch all projects with advisor name (admin only)
  type ProjectRow = {
    id: string
    client_company_name: string
    status: string | null
    tier: string | null
    updated_at: string | null
    created_at: string | null
    advisor_name: string | null
    advisor_email: string | null
  }
  let allProjects: ProjectRow[] = []

  if (displayRole === 'admin') {
    try {
      // Drizzle left join to get advisor per project
      const advisorMembers = db
        .select({
          project_id: projectMembers.project_id,
          user_id: projectMembers.user_id,
        })
        .from(projectMembers)
        .where(eq(projectMembers.role, 'advisor'))
        .as('advisor_members')

      const rows = await db
        .select({
          id: projects.id,
          client_company_name: projects.client_company_name,
          status: projects.status,
          tier: projects.tier,
          updated_at: projects.updated_at,
          created_at: projects.created_at,
          advisor_name: users.name,
          advisor_email: users.email,
        })
        .from(projects)
        .leftJoin(advisorMembers, eq(advisorMembers.project_id, projects.id))
        .leftJoin(users, eq(users.id, advisorMembers.user_id))
        .orderBy(desc(projects.updated_at))
        .all()

      allProjects = rows as unknown as ProjectRow[]
    } catch {
      // Non-fatal
    }
  }

  // Fetch current logo
  const currentLogo = await getLogoUrl()

  return (
    <SettingsClient
      currentUserId={session.userId}
      currentRole={displayRole}
      displayEmail={displayEmail}
      displayName={displayName}
      displayRole={displayRole}
      initials={initials}
      users={allUsers}
      projects={allProjects}
      currentLogo={currentLogo}
    />
  )
}

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, users } from '@/lib/db/schema'
import { eq, or, ne } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FolderKanban,
  TrendingUp,
  FileCheck,
  MonitorCheck,
  Plus,
} from 'lucide-react'
import { DashboardProjectList } from '@/components/dashboard/project-list'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Fetch all projects for this advisor (created_by OR in project_members as advisor)
  let userProjects: Array<{
    id: string
    name: string
    client_company_name: string
    client_contact_email: string
    headcount: number | null
    tier: string | null
    status: string | null
    readiness_level: string | null
    scope_notes: string | null
    created_at: Date | null
    updated_at: Date | null
  }> = []

  try {
    // Get projects created by the user
    const createdProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.created_by, session.userId))
      .all()

    // Get projects where user is a member
    const memberProjectIds = await db
      .select({ project_id: projectMembers.project_id })
      .from(projectMembers)
      .where(eq(projectMembers.user_id, session.userId))
      .all()

    const memberIds = memberProjectIds.map((m) => m.project_id)

    // Fetch those member projects (if any), avoiding duplicates
    let memberProjects: typeof createdProjects = []
    if (memberIds.length > 0) {
      const createdIds = new Set(createdProjects.map((p) => p.id))
      for (const pid of memberIds) {
        if (!createdIds.has(pid)) {
          const p = await db
            .select()
            .from(projects)
            .where(eq(projects.id, pid))
            .get()
          if (p) memberProjects.push(p)
        }
      }
    }

    // Combine and sort by updated_at desc
    userProjects = [...createdProjects, ...memberProjects].sort((a, b) => {
      const aTime = a.updated_at?.getTime() ?? a.created_at?.getTime() ?? 0
      const bTime = b.updated_at?.getTime() ?? b.created_at?.getTime() ?? 0
      return bTime - aTime
    })
  } catch {
    // Non-fatal: render with empty state
  }

  // Compute stats
  const totalProjects = userProjects.length
  const activeProjects = userProjects.filter((p) => p.status !== 'outputs').length
  const draftReadyCount = userProjects.filter(
    (p) => p.readiness_level === 'draft_ready'
  ).length
  const demoReadyCount = userProjects.filter(
    (p) => p.readiness_level === 'demo_ready'
  ).length

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-header-lg text-outsail-navy">Dashboard</h1>
          <p className="text-body text-outsail-gray-600 mt-1">
            Manage your Blueprint discovery projects.
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium text-white transition-colors bg-outsail-teal hover:bg-outsail-teal-dark"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">Total Projects</p>
                <p className="text-3xl font-bold text-outsail-navy">{totalProjects}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-outsail-teal-light flex items-center justify-center flex-shrink-0">
                <FolderKanban className="w-5 h-5 text-outsail-teal" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">Active</p>
                <p className="text-3xl font-bold text-outsail-navy">{activeProjects}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-outsail-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">Draft Ready</p>
                <p className="text-3xl font-bold text-outsail-navy">{draftReadyCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-5 h-5 text-outsail-amber" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">Demo Ready</p>
                <p className="text-3xl font-bold text-outsail-navy">{demoReadyCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-outsail-teal-light flex items-center justify-center flex-shrink-0">
                <MonitorCheck className="w-5 h-5 text-outsail-teal" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects section */}
      <div>
        <h2 className="text-header-sm text-outsail-navy mb-4">Projects</h2>
        <DashboardProjectList initialProjects={userProjects} />
      </div>
    </div>
  )
}

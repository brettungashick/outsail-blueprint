import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  FolderKanban,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus,
} from 'lucide-react'

export const metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Fetch stats
  let totalProjects = 0
  let activeProjects = 0
  let completedProjects = 0
  let recentProjects: Array<{
    id: string
    name: string
    client_company_name: string
    status: string | null
    tier: string | null
    created_at: Date | null
    headcount: number | null
  }> = []
  let userName: string | null = null

  try {
    const allProjects = await db.select().from(projects).all()
    totalProjects = allProjects.length
    activeProjects = allProjects.filter(
      (p) => p.status !== 'complete' && p.status !== 'setup'
    ).length
    completedProjects = allProjects.filter((p) => p.status === 'complete').length
    recentProjects = allProjects
      .sort((a, b) => {
        const aTime = a.created_at?.getTime() ?? 0
        const bTime = b.created_at?.getTime() ?? 0
        return bTime - aTime
      })
      .slice(0, 5) as typeof recentProjects

    const user = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()
    userName = user?.name ?? null
  } catch {
    // Non-fatal: render with zero stats
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const displayName = userName ?? session.email.split('@')[0]

  const statusLabel: Record<string, string> = {
    setup: 'Setup',
    intake: 'Intake',
    chat: 'Discovery',
    review: 'Review',
    complete: 'Complete',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-header-lg text-outsail-navy">
          {greeting()}, {displayName}
        </h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Here&apos;s an overview of your Blueprint projects.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">
                  Total Projects
                </p>
                <p className="text-3xl font-bold text-outsail-navy">
                  {totalProjects}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-outsail-teal-light flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-outsail-teal" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">
                  Active
                </p>
                <p className="text-3xl font-bold text-outsail-navy">
                  {activeProjects}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-outsail-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label text-outsail-gray-600 mb-1">
                  Completed
                </p>
                <p className="text-3xl font-bold text-outsail-navy">
                  {completedProjects}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-outsail-green" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-header-sm text-outsail-navy">Recent Projects</h2>
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-1 text-sm font-medium text-outsail-teal hover:text-outsail-teal-dark transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-outsail-teal-light flex items-center justify-center mx-auto mb-4">
                <FolderKanban className="w-7 h-7 text-outsail-teal" />
              </div>
              <h3 className="text-header-sm text-outsail-navy mb-2">
                No projects yet
              </h3>
              <p className="text-body text-outsail-gray-600 mb-6 max-w-sm mx-auto">
                Create your first Blueprint project to start capturing HR tech
                requirements.
              </p>
              <Link
                href="/dashboard/projects"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#1D9E75' }}
              >
                <Plus className="w-4 h-4" />
                New Project
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-outsail-gray-200">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-center justify-between p-4 hover:bg-outsail-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-outsail-navy truncate">
                        {project.name}
                      </p>
                      {project.tier && (
                        <Badge
                          variant={project.tier as 'essentials' | 'growth' | 'enterprise'}
                          className="text-xs"
                        >
                          {project.tier.charAt(0).toUpperCase() + project.tier.slice(1)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-outsail-gray-600 truncate">
                      {project.client_company_name}
                      {project.headcount
                        ? ` · ${project.headcount.toLocaleString()} employees`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <Badge
                      variant={
                        (project.status as
                          | 'setup'
                          | 'intake'
                          | 'chat'
                          | 'review'
                          | 'complete') ?? 'setup'
                      }
                    >
                      {statusLabel[project.status ?? 'setup'] ?? project.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-outsail-gray-600">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(project.created_at)}
                    </div>
                    <ArrowRight className="w-4 h-4 text-outsail-gray-200" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { ProjectTabs } from '@/components/dashboard/project-tabs'
import type { ProjectStatus, ProjectTier, SectionKey, SectionDepth, SectionStatus } from '@/types'

export const metadata = {
  title: 'Project Details',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  intake: 'Intake',
  discovery_complete: 'Discovery Done',
  summary_approved: 'Summary Approved',
  deep_discovery: 'Deep Discovery',
  blueprint_generation: 'Blueprint',
  client_review: 'Client Review',
  approved: 'Approved',
  outputs: 'Outputs',
}

const TIER_LABELS: Record<ProjectTier, string> = {
  essentials: 'Essentials',
  growth: 'Growth',
  enterprise: 'Enterprise',
}

function formatRelativeDate(date: Date | null | undefined): string {
  if (!date) return '—'
  const diffDays = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

interface ProjectRow {
  id: string
  name: string
  client_company_name: string
  client_contact_email: string
  headcount: number | null
  tier: string | null
  status: string
  scope_notes: string | null
  readiness_level: string | null
  created_by: string | null
  created_at: Date | null
  updated_at: Date | null
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Fetch project
  let project: ProjectRow | null = null

  try {
    const row = await db
      .select()
      .from(projects)
      .where(eq(projects.id, params.id))
      .get()

    if (!row) return notFound()

    // Verify user has access: created_by OR in project_members
    const memberCheck = await db
      .select({ user_id: projectMembers.user_id })
      .from(projectMembers)
      .where(eq(projectMembers.project_id, params.id))
      .all()

    const hasAccess =
      row.created_by === session.userId ||
      memberCheck.some((m) => m.user_id === session.userId)

    if (!hasAccess) {
      redirect('/login?error=unauthorized')
    }

    project = row as ProjectRow
  } catch (err) {
    console.error('[ProjectDetailPage] Error fetching project:', err)
    return notFound()
  }

  // Fetch blueprint sections
  let sections: Array<{
    id: string
    section_key: SectionKey
    section_name: string
    depth: SectionDepth
    status: SectionStatus
    completeness_score: number | null
  }> = []

  try {
    const rows = await db
      .select({
        id: blueprintSections.id,
        section_key: blueprintSections.section_key,
        section_name: blueprintSections.section_name,
        depth: blueprintSections.depth,
        status: blueprintSections.status,
        completeness_score: blueprintSections.completeness_score,
      })
      .from(blueprintSections)
      .where(eq(blueprintSections.project_id, params.id))
      .all()

    sections = rows as typeof sections
  } catch {
    // Non-fatal: render with empty sections
  }

  const typedProject = {
    id: project.id,
    name: project.name,
    client_company_name: project.client_company_name,
    client_contact_email: project.client_contact_email,
    headcount: project.headcount,
    tier: project.tier as ProjectTier | null,
    status: (project.status ?? 'intake') as ProjectStatus,
    scope_notes: project.scope_notes,
    readiness_level: project.readiness_level,
    created_at: project.created_at,
    updated_at: project.updated_at,
  }

  const statusVariant = typedProject.status as ProjectStatus
  const tierVariant = typedProject.tier as ProjectTier | null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-outsail-gray-600">
        <Link href="/dashboard" className="hover:text-outsail-navy transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <Link
          href="/dashboard/projects"
          className="hover:text-outsail-navy transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <span className="text-outsail-navy font-medium truncate max-w-48">
          {project.client_company_name}
        </span>
      </nav>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-header-lg text-outsail-navy">
              {project.client_company_name}
            </h1>
            <Badge variant={statusVariant}>
              {STATUS_LABELS[statusVariant]}
            </Badge>
            {tierVariant && (
              <Badge variant={tierVariant}>
                {TIER_LABELS[tierVariant]}
              </Badge>
            )}
          </div>
          <p className="text-body text-outsail-gray-600">
            Last updated{' '}
            {formatRelativeDate(project.updated_at ?? project.created_at)}
          </p>
        </div>
      </div>

      {/* Tabbed content */}
      <ProjectTabs
        project={typedProject}
        blueprintSections={sections}
      />
    </div>
  )
}

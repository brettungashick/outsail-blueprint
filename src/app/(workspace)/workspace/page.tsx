import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import Link from 'next/link'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections, techStackSystems } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { SectionKey, SectionStatus, SectionDepth } from '@/types'

export const dynamic = 'force-dynamic'

const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  advisor_review: 'Advisor Review',
  client_approved: 'Client Approved',
  complete: 'Complete',
}

const DEPTH_LABELS: Record<SectionDepth, string> = {
  light: 'Light',
  standard: 'Standard',
  deep: 'Deep',
}

const STATUS_DOT: Record<SectionStatus, string> = {
  not_started: 'bg-outsail-gray-200',
  in_progress: 'bg-outsail-amber',
  advisor_review: 'bg-outsail-purple',
  client_approved: 'bg-outsail-teal',
  complete: 'bg-outsail-green',
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  setup: 'Setup',
  intake: 'Intake',
  chat: 'Discovery',
  review: 'Review',
  complete: 'Complete',
}

const TIER_LABELS: Record<string, string> = {
  essentials: 'Essentials',
  growth: 'Growth',
  enterprise: 'Enterprise',
}

export default async function WorkspacePage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Find all projects this client is a member of, pick most recent
  const memberships = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, session.userId))
    .all()

  const projectIds = memberships.map((m) => m.project_id)

  let project: {
    id: string
    name: string
    client_company_name: string
    client_contact_email: string
    headcount: number | null
    tier: string | null
    status: string
    scope_notes: string | null
    readiness_level: string | null
    created_at: Date | null
    updated_at: Date | null
  } | null = null

  if (projectIds.length > 0) {
    // Get all member projects sorted by updated_at, pick first
    const rows = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.updated_at))
      .all()

    project = rows.find((r) => projectIds.includes(r.id)) ?? null
  }

  let sections: Array<{
    id: string
    section_key: SectionKey
    section_name: string
    depth: SectionDepth
    status: SectionStatus
    completeness_score: number | null
  }> = []

  if (project) {
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
        .where(eq(blueprintSections.project_id, project.id))
        .all()

      sections = rows as typeof sections
    } catch {
      // Non-fatal
    }
  }

  const overallCompleteness =
    sections.length > 0
      ? Math.round(sections.reduce((sum, s) => sum + (s.completeness_score ?? 0), 0) / sections.length)
      : 0

  const completedCount = sections.filter((s) => s.status === 'complete').length

  // Determine intake completion state
  const hasCompanyProfile = project?.scope_notes?.startsWith('{"__v":') ?? false
  let hasTechStack = false
  if (project) {
    try {
      const sys = await db
        .select({ id: techStackSystems.id })
        .from(techStackSystems)
        .where(eq(techStackSystems.project_id, project.id))
        .get()
      hasTechStack = sys != null
    } catch {
      // Non-fatal
    }
  }
  const intakeComplete = hasCompanyProfile && hasTechStack

  // Don't show raw JSON in the scope notes section
  const displayScopeNotes =
    project?.scope_notes && !project.scope_notes.startsWith('{"__v":')
      ? project.scope_notes
      : null

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-header-lg text-outsail-navy">
          Welcome{project ? `, ${project.client_company_name}` : ''}
        </h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          {project
            ? 'Here\'s an overview of your HR technology discovery.'
            : 'Your workspace is being set up. Check back soon.'}
        </p>
      </div>

      {!project && (
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600">
            No projects found. Your advisor will set up your workspace shortly.
          </p>
        </div>
      )}

      {project && (
        <>
          {/* Intake CTA */}
          {!intakeComplete && (
            <div className="rounded-card border-2 border-outsail-teal bg-outsail-teal-light p-6 flex items-center justify-between gap-6">
              <div>
                <h2 className="text-header-sm text-outsail-navy">Get Started</h2>
                <p className="text-body text-outsail-slate mt-1">
                  Complete your intake to begin building your Blueprint. It only takes a few minutes.
                </p>
              </div>
              <Link
                href="/workspace/intake"
                className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-semibold text-white bg-outsail-teal hover:bg-outsail-teal-dark transition-colors"
              >
                Start Intake →
              </Link>
            </div>
          )}

          {intakeComplete && (
            <div className="rounded-card border border-outsail-gray-200 bg-white p-6 flex items-center justify-between gap-6">
              <div>
                <h2 className="text-header-sm text-outsail-navy">Intake Complete</h2>
                <p className="text-body text-outsail-gray-600 mt-1">
                  Your company profile and tech stack are saved. Ready for the Blueprint Assistant.
                </p>
              </div>
              <Link
                href="/workspace/intake/discovery"
                className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-semibold text-white bg-outsail-navy hover:bg-outsail-navy/90 transition-colors"
              >
                Continue →
              </Link>
            </div>
          )}

          {/* Project summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="outsail-card">
              <p className="text-label text-outsail-gray-600 mb-1">Project Stage</p>
              <p className="text-header-sm text-outsail-navy">
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </p>
            </div>
            <div className="outsail-card">
              <p className="text-label text-outsail-gray-600 mb-1">Sections Complete</p>
              <p className="text-header-sm text-outsail-navy">
                {completedCount}{' '}
                <span className="text-body text-outsail-gray-600 font-normal">
                  / {sections.length}
                </span>
              </p>
            </div>
            <div className="outsail-card">
              <p className="text-label text-outsail-gray-600 mb-1">Overall Progress</p>
              <p className="text-header-sm text-outsail-navy">{overallCompleteness}%</p>
              <div className="w-full h-1.5 rounded-full bg-outsail-gray-200 mt-2">
                <div
                  className="h-1.5 rounded-full bg-outsail-teal transition-all"
                  style={{ width: `${overallCompleteness}%` }}
                />
              </div>
            </div>
          </div>

          {/* Project info */}
          <div className="outsail-card">
            <h2 className="text-header-sm text-outsail-navy mb-4">Project Info</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-label text-outsail-gray-600">Company</p>
                <p className="text-body text-outsail-slate">{project.client_company_name}</p>
              </div>
              {project.headcount && (
                <div>
                  <p className="text-label text-outsail-gray-600">Headcount</p>
                  <p className="text-body text-outsail-slate">
                    {project.headcount.toLocaleString()} employees
                  </p>
                </div>
              )}
              {project.tier && (
                <div>
                  <p className="text-label text-outsail-gray-600">Project Tier</p>
                  <p className="text-body text-outsail-slate">{TIER_LABELS[project.tier] ?? project.tier}</p>
                </div>
              )}
              {project.readiness_level && (
                <div>
                  <p className="text-label text-outsail-gray-600">Readiness</p>
                  <p className="text-body text-outsail-slate capitalize">
                    {project.readiness_level.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
              {displayScopeNotes && (
                <div className="col-span-2">
                  <p className="text-label text-outsail-gray-600">Scope Notes</p>
                  <p className="text-body text-outsail-slate whitespace-pre-line">{displayScopeNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Blueprint sections grid */}
          {sections.length > 0 && (
            <div className="outsail-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-header-sm text-outsail-navy">Blueprint Sections</h2>
                <span className="text-sm text-outsail-gray-600">{overallCompleteness}% complete</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-card border border-outsail-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-outsail-navy leading-tight">
                        {section.section_name}
                      </p>
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${STATUS_DOT[section.status]}`}
                        title={SECTION_STATUS_LABELS[section.status]}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${
                          section.depth === 'light'
                            ? 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'
                            : section.depth === 'standard'
                            ? 'bg-blue-50 text-outsail-blue border-blue-200'
                            : 'bg-outsail-navy/5 text-outsail-navy border-outsail-navy/20'
                        }`}
                      >
                        {DEPTH_LABELS[section.depth]}
                      </span>
                      <span className="text-xs text-outsail-gray-600">
                        {section.completeness_score ?? 0}%
                      </span>
                    </div>
                    <p className="text-xs text-outsail-gray-600">
                      {SECTION_STATUS_LABELS[section.status]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

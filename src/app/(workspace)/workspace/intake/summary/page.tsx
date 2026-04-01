import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { IntakeStepper } from '@/components/workspace/intake-stepper'
import { SummaryReviewClient } from './_summary-review-client'

export const dynamic = 'force-dynamic'

const INTAKE_STEPS = ['Company Profile', 'Tech Stack', 'Discovery Chat', 'Summary Review']

export default async function SummaryReviewPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) redirect('/login')

  const memberships = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .all()

  const projectIds = memberships.map((m) => m.project_id)
  if (projectIds.length === 0) redirect('/workspace/intake/discovery')

  const projectRows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updated_at))
    .all()

  const project = projectRows.find((r) => projectIds.includes(r.id))
  if (!project) redirect('/workspace/intake/discovery')

  // If not yet at summary stage, redirect back to discovery
  const summaryStatuses = ['discovery_complete', 'summary_approved', 'deep_discovery', 'blueprint_generation', 'client_review', 'approved', 'outputs']
  if (!summaryStatuses.includes(project.status)) {
    redirect('/workspace/intake/discovery')
  }

  // Parse discovery_summary
  let discoverySummary: DiscoverySummaryData | null = null
  if (project.discovery_summary) {
    try {
      discoverySummary = JSON.parse(project.discovery_summary) as DiscoverySummaryData
    } catch { /* ignore */ }
  }

  // Parse recommended_sections
  let recommendedSections: RecommendedSection[] = []
  if (project.recommended_sections) {
    try {
      recommendedSections = JSON.parse(project.recommended_sections) as RecommendedSection[]
    } catch { /* ignore */ }
  }

  // Parse client_edits if already saved
  let clientEdits: ClientEdits | null = null
  if (project.client_edits) {
    try {
      clientEdits = JSON.parse(project.client_edits) as ClientEdits
    } catch { /* ignore */ }
  }

  const isApproved = project.status !== 'discovery_complete'

  return (
    <div className="space-y-6">
      <IntakeStepper currentStep={4} steps={INTAKE_STEPS} />

      <div>
        <h1 className="text-header-lg text-outsail-navy">Summary Review</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Here's what we captured in your discovery session. Review and correct anything, then notify your advisor.
        </p>
      </div>

      <SummaryReviewClient
        projectId={project.id}
        companyName={project.client_company_name}
        discoverySummary={discoverySummary}
        recommendedSections={recommendedSections}
        initialClientEdits={clientEdits}
        isApproved={isApproved}
        advisorEmail={null}
      />
    </div>
  )
}

// ── Types (shared with client component) ──────────────────────────────────

export interface DiscoverySummaryData {
  overview?: string
  pain_points?: Array<{ description: string; severity: string }>
  priorities?: Array<{ priority: string; rank: number }>
  vendors_staying?: Array<{ name: string; reason?: string }>
  vendors_replacing?: Array<{ name: string; reason?: string }>
  project_params?: {
    go_live_date?: string
    budget_status?: string
    decision_team?: string
  }
  complexity_signals?: Array<{ area: string; description: string; severity: string }>
}

export interface RecommendedSection {
  key: string
  title: string
  recommended_depth: 'light' | 'standard' | 'deep'
  discovery_priority: 'critical' | 'high' | 'medium' | 'low'
  notes: string
}

export interface ClientEdits {
  pain_points?: Array<{ description: string; severity: string }>
  priorities?: Array<{ priority: string; rank: number }>
  vendors_staying?: Array<{ name: string }>
  vendors_replacing?: Array<{ name: string }>
  additional_context?: string
  section_flags?: Record<string, string>
}

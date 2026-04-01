import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { IntakeStepper } from '@/components/workspace/intake-stepper'
import { CompanyProfileForm } from './_company-profile-form'

export const dynamic = 'force-dynamic'

const INTAKE_STEPS = ['Company Profile', 'Tech Stack', 'Discovery Chat', 'Summary Review']

interface CompanyProfileData {
  __v: number
  headcount_projected?: number
  hq_city?: string
  hq_state?: string
  hq_country?: string
  is_multi_state?: boolean
  multi_state_count?: number
  has_international?: boolean
  international_employment_types?: string[]
  workforce_salaried_pct?: number
  workforce_fulltime_pct?: number
  ownership_structure?: string
  industry?: string
}

export default async function IntakePage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Find project for this user
  const memberships = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, session.userId))
    .all()

  const projectIds = memberships.map((m) => m.project_id)

  let project: {
    id: string
    client_company_name: string
    headcount: number | null
    scope_notes: string | null
  } | null = null

  if (projectIds.length > 0) {
    const rows = await db
      .select({
        id: projects.id,
        client_company_name: projects.client_company_name,
        headcount: projects.headcount,
        scope_notes: projects.scope_notes,
      })
      .from(projects)
      .orderBy(desc(projects.updated_at))
      .all()

    project = rows.find((r) => projectIds.includes(r.id)) ?? null
  }

  if (!project) {
    return (
      <div className="space-y-8">
        <IntakeStepper currentStep={1} steps={INTAKE_STEPS} />
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600">
            No project found. Your advisor will set up your workspace shortly.
          </p>
        </div>
      </div>
    )
  }

  // Parse company profile from scope_notes
  let profile: CompanyProfileData | null = null
  if (project.scope_notes?.startsWith('{"__v":')) {
    try {
      profile = JSON.parse(project.scope_notes) as CompanyProfileData
    } catch {
      profile = null
    }
  }

  return (
    <div className="space-y-8">
      <IntakeStepper currentStep={1} steps={INTAKE_STEPS} />

      <div>
        <h1 className="text-header-lg text-outsail-navy">Company Profile</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Tell us about your company so we can tailor the blueprint to your needs.
        </p>
      </div>

      <CompanyProfileForm
        projectId={project.id}
        initialValues={{
          company_name: project.client_company_name,
          headcount_current: project.headcount ?? undefined,
          headcount_projected: profile?.headcount_projected,
          hq_city: profile?.hq_city,
          hq_state: profile?.hq_state,
          hq_country: profile?.hq_country,
          is_multi_state: profile?.is_multi_state,
          multi_state_count: profile?.multi_state_count,
          has_international: profile?.has_international,
          international_employment_types: profile?.international_employment_types,
          workforce_salaried_pct: profile?.workforce_salaried_pct,
          workforce_fulltime_pct: profile?.workforce_fulltime_pct,
          ownership_structure: profile?.ownership_structure,
          industry: profile?.industry,
        }}
      />
    </div>
  )
}

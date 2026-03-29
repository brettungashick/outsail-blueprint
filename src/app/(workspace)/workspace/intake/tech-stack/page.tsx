import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, techStackSystems, integrations } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { IntakeStepper } from '@/components/workspace/intake-stepper'
import { TechStackBuilderWrapper } from './_tech-stack-wrapper'

export const dynamic = 'force-dynamic'

const INTAKE_STEPS = ['Company Profile', 'Tech Stack', 'Requirements', 'Processes', 'Review']

export default async function TechStackIntakePage() {
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

  let projectId: string | null = null

  if (projectIds.length > 0) {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .orderBy(desc(projects.updated_at))
      .all()

    const found = rows.find((r) => projectIds.includes(r.id))
    projectId = found?.id ?? null
  }

  if (!projectId) {
    return (
      <div className="space-y-8">
        <IntakeStepper currentStep={2} steps={INTAKE_STEPS} />
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600">
            No project found. Your advisor will set up your workspace shortly.
          </p>
        </div>
      </div>
    )
  }

  // Fetch existing tech stack data
  const rawSystems = await db
    .select()
    .from(techStackSystems)
    .where(eq(techStackSystems.project_id, projectId))
    .all()

  const rawIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.project_id, projectId))
    .all()

  // Parse systems
  const parsedSystems = rawSystems.map((s) => {
    let modules: string[] = []
    try {
      if (s.modules_used) modules = JSON.parse(s.modules_used) as string[]
    } catch { /* empty */ }

    let ratings = { admin: 3, employee: 3, service: 3 }
    try {
      if (s.notes) {
        const parsed = JSON.parse(s.notes) as { ratings?: typeof ratings }
        if (parsed.ratings) ratings = parsed.ratings
      }
    } catch { /* empty */ }

    return {
      id: s.id,
      system_name: s.system_name,
      vendor: s.vendor,
      system_type: s.system_type,
      is_primary: s.is_primary ?? false,
      modules_used: modules,
      ratings,
      experience_rating: s.experience_rating,
    }
  })

  // Parse integrations
  const parsedIntegrations = rawIntegrations.map((i) => ({
    source_id: i.source_system_id,
    target_id: i.target_system_id,
    quality: i.integration_quality as 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual',
  }))

  const hasData = parsedSystems.length > 0

  return (
    <div className="space-y-8">
      <IntakeStepper currentStep={2} steps={INTAKE_STEPS} />

      <div>
        <h1 className="text-header-lg text-outsail-navy">Tech Stack</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Map out your current HR technology landscape — primary platform, point solutions, and how they connect.
        </p>
      </div>

      <TechStackBuilderWrapper
        projectId={projectId}
        initialSystems={parsedSystems}
        initialIntegrations={parsedIntegrations}
        hasExistingData={hasData}
      />
    </div>
  )
}

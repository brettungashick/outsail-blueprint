import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, techStackSystems, integrations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { TechStackCanvas } from '@/components/tech-stack/tech-stack-canvas'

export const dynamic = 'force-dynamic'

export default async function ProjectTechStackPage({
  params,
}: {
  params: { id: string }
}) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Verify project access
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .get()

  if (!project) return notFound()

  const memberCheck = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, params.id))
    .all()

  const hasAccess =
    project.created_by === session.userId ||
    memberCheck.some((m) => m.user_id === session.userId)

  if (!hasAccess) redirect('/login?error=unauthorized')

  // Fetch tech stack data
  const rawSystems = await db
    .select()
    .from(techStackSystems)
    .where(eq(techStackSystems.project_id, params.id))
    .all()

  const rawIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.project_id, params.id))
    .all()

  // Parse systems
  type IntegrationQuality = 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual'
  type IntegrationDirection = 'to_primary' | 'from_primary' | 'bidirectional'

  const parsedSystems = rawSystems.map((s) => {
    let modules: string[] = []
    try { if (s.modules_used) modules = JSON.parse(s.modules_used) as string[] } catch { /* empty */ }

    let ratings = { admin: 3, employee: 3, service: 3 }
    let integrationDirection: IntegrationDirection = 'bidirectional'
    let vendorNotes = ''
    let alsoCoversLabels: string[] = []
    let isCustom = false
    let customModules: string[] = []
    try {
      if (s.notes) {
        const parsed = JSON.parse(s.notes) as {
          ratings?: typeof ratings
          integrationDirection?: IntegrationDirection
          vendorNotes?: string
          alsoCoversLabels?: string[]
          isCustom?: boolean
          customModules?: string[]
        }
        if (parsed.ratings) ratings = parsed.ratings
        if (parsed.integrationDirection) integrationDirection = parsed.integrationDirection
        if (parsed.vendorNotes) vendorNotes = parsed.vendorNotes
        if (Array.isArray(parsed.alsoCoversLabels)) alsoCoversLabels = parsed.alsoCoversLabels
        if (parsed.isCustom !== undefined) isCustom = parsed.isCustom
        if (Array.isArray(parsed.customModules)) customModules = parsed.customModules
      }
    } catch { /* empty */ }

    return {
      id: s.id,
      system_name: s.system_name,
      vendor: s.vendor,
      is_primary: s.is_primary ?? false,
      modules_used: modules,
      ratings,
      integrationDirection,
      vendorNotes,
      alsoCoversLabels,
      isCustom,
      customModules,
    }
  })

  // Build quality map
  const qualityMap: Record<string, IntegrationQuality> = {}
  for (const i of rawIntegrations) {
    qualityMap[i.source_system_id] = i.integration_quality as IntegrationQuality
  }

  // Reconstruct canvas props
  const primary = parsedSystems.find((s) => s.is_primary)

  interface PointSolutionData {
    vendor: string
    ratings: { admin: number; employee: number; service: number }
    alsoCovers: string[]
    notes: string
    integrationQuality: IntegrationQuality
    integrationDirection: IntegrationDirection
  }

  const initialPointSolutions: Record<string, PointSolutionData[]> = {}
  for (const s of parsedSystems) {
    if (s.is_primary) continue
    const label = s.modules_used[0]
    if (!label) continue
    if (!initialPointSolutions[label]) initialPointSolutions[label] = []
    initialPointSolutions[label].push({
      vendor: s.vendor ?? s.system_name,
      ratings: s.ratings,
      alsoCovers: s.alsoCoversLabels ?? s.modules_used.slice(1),
      notes: s.vendorNotes ?? '',
      integrationQuality: qualityMap[s.id] ?? 'mostly_automated',
      integrationDirection: s.integrationDirection ?? 'bidirectional',
    })
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-outsail-gray-600">
        <Link href="/dashboard" className="hover:text-outsail-navy transition-colors">Dashboard</Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <Link href="/dashboard/projects" className="hover:text-outsail-navy transition-colors">Projects</Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <Link href={`/dashboard/projects/${params.id}`} className="hover:text-outsail-navy transition-colors">
          {project.client_company_name}
        </Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <span className="text-outsail-navy font-medium">Tech Stack</span>
      </nav>

      <div>
        <h1 className="text-header-lg text-outsail-navy">Tech Stack</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Current HR technology landscape for {project.client_company_name}.
        </p>
      </div>

      {rawSystems.length === 0 ? (
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600">No tech stack data has been entered yet.</p>
        </div>
      ) : (
        <TechStackCanvas
          projectId={params.id}
          initialPrimaryVendor={primary?.vendor ?? ''}
          initialCoveredModules={primary?.modules_used ?? []}
          initialPointSolutions={initialPointSolutions}
          initialCustomModules={primary?.customModules ?? []}
          readOnly
        />
      )}
    </div>
  )
}

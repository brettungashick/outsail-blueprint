import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, techStackSystems, integrations } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { CATEGORY_TO_SYSTEM_TYPE } from '@/lib/tech-stack/vendors'

async function verifyAccess(request: NextRequest, projectId: string) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return null

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) return null

  if (project.created_by !== session.userId) {
    const membership = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.project_id, projectId))
      .all()

    const hasMembership = membership.some((m) => m.user_id === session.userId)
    if (!hasMembership) return null
  }

  return { session, project }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await verifyAccess(request, params.id)
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const systems = await db
    .select()
    .from(techStackSystems)
    .where(eq(techStackSystems.project_id, params.id))
    .all()

  const ints = await db
    .select()
    .from(integrations)
    .where(eq(integrations.project_id, params.id))
    .all()

  return NextResponse.json({ systems, integrations: ints })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await verifyAccess(request, params.id)
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    system_name: string
    is_primary: boolean
    modules_used: string[]
    ratings: { admin: number; employee: number; service: number }
    system_type: string | null
    vendor?: string
  }

  const { system_name, is_primary, modules_used, ratings, system_type, vendor } = body

  const avgRating = Math.round((ratings.admin + ratings.employee + ratings.service) / 3)

  const system = await db
    .insert(techStackSystems)
    .values({
      project_id: params.id,
      system_name,
      vendor: vendor ?? system_name,
      system_type: system_type as typeof techStackSystems.$inferInsert['system_type'],
      is_primary,
      modules_used: JSON.stringify(modules_used),
      experience_rating: avgRating,
      notes: JSON.stringify({ ratings }),
    })
    .returning()
    .get()

  return NextResponse.json({ systemId: system.id }, { status: 201 })
}

// PUT /api/projects/[id]/tech-stack
// Full-replace: delete all existing systems + integrations, recreate from canvas state.
// Accepts both the Part-1 simple payload (primaryVendor only) and the full canvas payload.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await verifyAccess(request, params.id)
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    primaryVendor?: string
    primaryModules?: string[]
    primaryRatings?: { admin: number; employee: number; service: number }
    primaryX?: number
    primaryY?: number
    allModulePositions?: Record<string, { x: number; y: number }>
    customModules?: string[]
    modules?: Array<{
      id: string
      label: string
      isCustom: boolean
      canvasX: number
      canvasY: number
      vendor: string
      vendorNotes: string
      coveredByPrimary: boolean
      ratings: { admin: number; employee: number; service: number }
      integrationQuality: 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual'
      integrationDirection: 'to_primary' | 'from_primary' | 'bidirectional'
      alsoCovers: string[]
      alsoCoversLabels?: string[]
    }>
  }

  // 1. Delete existing integrations then systems (FK order)
  await db.delete(integrations).where(eq(integrations.project_id, params.id))
  await db.delete(techStackSystems).where(eq(techStackSystems.project_id, params.id))

  const primaryVendor = body.primaryVendor?.trim() ?? ''
  if (!primaryVendor) {
    return NextResponse.json({ ok: true })
  }

  const primaryRatings = body.primaryRatings ?? { admin: 3, employee: 3, service: 3 }
  const primaryAvg = Math.round((primaryRatings.admin + primaryRatings.employee + primaryRatings.service) / 3)
  const primaryModules = body.primaryModules ?? []

  // 2. Insert primary system
  const primaryRow = await db
    .insert(techStackSystems)
    .values({
      project_id: params.id,
      system_name: primaryVendor,
      vendor: primaryVendor,
      system_type: 'primary_hris',
      is_primary: true,
      modules_used: JSON.stringify(primaryModules),
      experience_rating: primaryAvg,
      notes: JSON.stringify({
        ratings: primaryRatings,
        canvasX: body.primaryX ?? null,
        canvasY: body.primaryY ?? null,
        allModulePositions: body.allModulePositions ?? {},
        customModules: body.customModules ?? [],
      }),
    })
    .returning()
    .get()

  const primaryId = primaryRow.id

  // 3. Insert point solutions (modules with a vendor)
  const modulesToSave = body.modules?.filter((m) => m.vendor.trim()) ?? []

  for (const mod of modulesToSave) {
    const avg = Math.round((mod.ratings.admin + mod.ratings.employee + mod.ratings.service) / 3)
    const alsoCoversLabels = mod.alsoCoversLabels ??
      (mod.alsoCovers ?? [])
        .map((covId) => body.modules?.find((m) => m.id === covId)?.label)
        .filter((l): l is string => Boolean(l))

    const ps = await db
      .insert(techStackSystems)
      .values({
        project_id: params.id,
        system_name: mod.vendor.trim(),
        vendor: mod.vendor.trim(),
        system_type: (CATEGORY_TO_SYSTEM_TYPE[mod.label] ?? 'other') as typeof techStackSystems.$inferInsert['system_type'],
        is_primary: false,
        modules_used: JSON.stringify([mod.label, ...alsoCoversLabels]),
        experience_rating: avg,
        notes: JSON.stringify({
          moduleId: mod.id,
          isCustom: mod.isCustom,
          customLabel: mod.isCustom ? mod.label : undefined,
          ratings: mod.ratings,
          canvasX: mod.canvasX,
          canvasY: mod.canvasY,
          integrationDirection: mod.integrationDirection,
          alsoCoversLabels: alsoCoversLabels,
          vendorNotes: mod.vendorNotes,
          coveredByPrimary: mod.coveredByPrimary,
        }),
      })
      .returning()
      .get()

    // 4. Insert integration (point solution → primary)
    await db.insert(integrations).values({
      project_id: params.id,
      source_system_id: ps.id,
      target_system_id: primaryId,
      integration_quality: mod.integrationQuality,
    })
  }

  return NextResponse.json({ ok: true })
}

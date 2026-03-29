import { NextRequest, NextResponse } from 'next/server'
import { eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, organizations, projectMembers } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { createId } from '@paralleldrive/cuid2'

interface CompanyProfileData {
  __v: 1
  headcount_projected?: number
  hq_location?: string
  additional_locations?: string[]
  workforce_salaried_pct?: number
  workforce_fulltime_pct?: number
  ownership_structure?: string
  industry?: string
  growth_notes?: string
}

async function verifyAccess(request: NextRequest, projectId: string) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return null

  // Check project membership
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) return null

  // Check if user is creator or member
  const isMember = project.created_by === session.userId

  if (!isMember) {
    const membership = await db
      .select()
      .from(projectMembers)
      .where(
        eq(projectMembers.project_id, projectId)
      )
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

  const { project } = access

  let profile: CompanyProfileData | null = null
  if (project.scope_notes?.startsWith('{"__v":1')) {
    try {
      profile = JSON.parse(project.scope_notes) as CompanyProfileData
    } catch {
      profile = null
    }
  }

  return NextResponse.json({
    project: {
      id: project.id,
      client_company_name: project.client_company_name,
      headcount: project.headcount,
      scope_notes: project.scope_notes,
    },
    profile,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await verifyAccess(request, params.id)
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { project } = access

  const body = await request.json() as {
    company_name?: string
    headcount_current?: number
    headcount_projected?: number
    hq_location?: string
    additional_locations?: string[]
    workforce_salaried_pct?: number
    workforce_fulltime_pct?: number
    ownership_structure?: string
    industry?: string
    growth_notes?: string
  }

  const profileData: CompanyProfileData = {
    __v: 1,
    headcount_projected: body.headcount_projected,
    hq_location: body.hq_location,
    additional_locations: body.additional_locations,
    workforce_salaried_pct: body.workforce_salaried_pct,
    workforce_fulltime_pct: body.workforce_fulltime_pct,
    ownership_structure: body.ownership_structure,
    industry: body.industry,
    growth_notes: body.growth_notes,
  }

  // Clean undefined values
  const cleaned = Object.fromEntries(
    Object.entries(profileData).filter(([, v]) => v !== undefined)
  ) as CompanyProfileData

  const companyName = body.company_name ?? project.client_company_name

  // Upsert organization
  let orgId = project.organization_id
  if (companyName) {
    let org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, companyName))
      .get()

    if (!org) {
      org = await db
        .insert(organizations)
        .values({ id: createId(), name: companyName })
        .returning()
        .get()
    }

    orgId = org.id
  }

  await db
    .update(projects)
    .set({
      client_company_name: companyName,
      headcount: body.headcount_current ?? project.headcount,
      scope_notes: JSON.stringify(cleaned),
      organization_id: orgId ?? undefined,
      updated_at: new Date(),
    })
    .where(eq(projects.id, params.id))

  return NextResponse.json({ ok: true })
}

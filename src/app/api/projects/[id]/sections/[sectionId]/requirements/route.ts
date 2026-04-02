import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, requirements } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function verifyAdvisorAccess(req: NextRequest, projectId: string) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth) return null
  if (auth.role !== 'advisor' && auth.role !== 'admin') return null

  const project = await db
    .select({ id: projects.id, created_by: projects.created_by })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()
  if (!project) return null

  const members = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .all()

  const hasAccess =
    project.created_by === auth.userId ||
    members.some((m) => m.user_id === auth.userId) ||
    auth.role === 'admin'

  return hasAccess ? auth : null
}

// GET /api/projects/[id]/sections/[sectionId]/requirements
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reqs = await db
    .select()
    .from(requirements)
    .where(eq(requirements.section_id, params.sectionId))
    .all()

  return NextResponse.json({ requirements: reqs })
}

// POST /api/projects/[id]/sections/[sectionId]/requirements
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    module: string
    future_requirement: string
    source?: string
    criticality?: string
    business_impact?: string
    frequency?: string
    user_population?: string
    compliance_regulatory?: string
    implementation_complexity?: string
    differentiator?: boolean
    sub_process?: string
  }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.module || !body.future_requirement) {
    return NextResponse.json({ error: 'module and future_requirement required' }, { status: 400 })
  }

  const now = new Date()
  const id = createId()

  await db.insert(requirements).values({
    id,
    project_id: params.id,
    section_id: params.sectionId,
    module: body.module,
    future_requirement: body.future_requirement,
    source: (body.source ?? 'advisor') as 'chat' | 'transcript' | 'intake' | 'advisor',
    criticality: body.criticality as 'must_have' | 'should_have' | 'could_have' | 'wont_have' | undefined,
    business_impact: body.business_impact,
    frequency: body.frequency,
    user_population: body.user_population,
    compliance_regulatory: body.compliance_regulatory,
    implementation_complexity: body.implementation_complexity as 'low' | 'medium' | 'high' | undefined,
    differentiator: body.differentiator ?? false,
    sub_process: body.sub_process,
    created_at: now,
    updated_at: now,
  })

  return NextResponse.json({ id, ok: true }, { status: 201 })
}

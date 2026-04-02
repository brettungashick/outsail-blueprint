import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, requirements } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH /api/projects/[id]/requirements/[reqId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; reqId: string } }
) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'advisor' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await db
    .select({ created_by: projects.created_by })
    .from(projects)
    .where(eq(projects.id, params.id))
    .get()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const members = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, params.id))
    .all()

  const hasAccess =
    project.created_by === auth.userId ||
    members.some((m) => m.user_id === auth.userId) ||
    auth.role === 'admin'
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    module?: string
    future_requirement?: string
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

  const patch: Record<string, unknown> = { updated_at: new Date() }
  if (body.module !== undefined) patch.module = body.module
  if (body.future_requirement !== undefined) patch.future_requirement = body.future_requirement
  if (body.source !== undefined) patch.source = body.source
  if (body.criticality !== undefined) patch.criticality = body.criticality
  if (body.business_impact !== undefined) patch.business_impact = body.business_impact
  if (body.frequency !== undefined) patch.frequency = body.frequency
  if (body.user_population !== undefined) patch.user_population = body.user_population
  if (body.compliance_regulatory !== undefined) patch.compliance_regulatory = body.compliance_regulatory
  if (body.implementation_complexity !== undefined) patch.implementation_complexity = body.implementation_complexity
  if (body.differentiator !== undefined) patch.differentiator = body.differentiator

  await db
    .update(requirements)
    .set(patch)
    .where(eq(requirements.id, params.reqId))

  return NextResponse.json({ ok: true })
}

// DELETE /api/projects/[id]/requirements/[reqId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; reqId: string } }
) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth || (auth.role !== 'advisor' && auth.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(requirements).where(eq(requirements.id, params.reqId))
  return NextResponse.json({ ok: true })
}

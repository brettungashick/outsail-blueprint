import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, requirements } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { hasProjectAccess } from '@/lib/auth/access'
import type { SessionPayload } from '@/types'

export const dynamic = 'force-dynamic'

// Shared gate: advisor/admin session that has access to the path project AND
// where the target requirement actually belongs to that project (prevents
// cross-project writes via a foreign reqId).
async function authorizeRequirement(
  req: NextRequest,
  projectId: string,
  reqId: string
): Promise<{ auth: SessionPayload } | { error: NextResponse }> {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (auth.role !== 'advisor' && auth.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const project = await db
    .select({ created_by: projects.created_by })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }

  const members = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .all()
  if (!hasProjectAccess(project, members, auth)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const target = await db
    .select({ project_id: requirements.project_id })
    .from(requirements)
    .where(eq(requirements.id, reqId))
    .get()
  if (!target || target.project_id !== projectId) {
    return { error: NextResponse.json({ error: 'Requirement not found' }, { status: 404 }) }
  }

  return { auth }
}

// PATCH /api/projects/[id]/requirements/[reqId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; reqId: string } }
) {
  const gate = await authorizeRequirement(req, params.id, params.reqId)
  if ('error' in gate) return gate.error

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
  const gate = await authorizeRequirement(req, params.id, params.reqId)
  if ('error' in gate) return gate.error

  await db.delete(requirements).where(eq(requirements.id, params.reqId))
  return NextResponse.json({ ok: true })
}

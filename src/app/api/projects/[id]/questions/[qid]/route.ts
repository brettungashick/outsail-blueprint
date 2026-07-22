import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, openQuestions } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { hasProjectAccess } from '@/lib/auth/access'
import type { SessionPayload } from '@/types'

export const dynamic = 'force-dynamic'

// Shared gate: advisor/admin session with access to the path project AND where
// the target question actually belongs to that project (prevents cross-project
// writes/deletes via a foreign qid).
async function authorizeQuestion(
  req: NextRequest,
  projectId: string,
  qid: string
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
  if (!project) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const members = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .all()
  if (!hasProjectAccess(project, members, auth)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const target = await db
    .select({ project_id: openQuestions.project_id })
    .from(openQuestions)
    .where(eq(openQuestions.id, qid))
    .get()
  if (!target || target.project_id !== projectId) {
    return { error: NextResponse.json({ error: 'Question not found' }, { status: 404 }) }
  }

  return { auth }
}

// PATCH /api/projects/[id]/questions/[qid]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  const gate = await authorizeQuestion(req, params.id, params.qid)
  if ('error' in gate) return gate.error

  let body: { status?: string; answer?: string; assigned_to?: string; question_text?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date() }
  if (body.status !== undefined) patch.status = body.status
  if (body.answer !== undefined) patch.answer = body.answer
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to
  if (body.question_text !== undefined) patch.question_text = body.question_text

  await db
    .update(openQuestions)
    .set(patch)
    .where(eq(openQuestions.id, params.qid))

  return NextResponse.json({ ok: true })
}

// DELETE /api/projects/[id]/questions/[qid]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; qid: string } }
) {
  const gate = await authorizeQuestion(req, params.id, params.qid)
  if ('error' in gate) return gate.error

  await db.delete(openQuestions).where(eq(openQuestions.id, params.qid))
  return NextResponse.json({ ok: true })
}

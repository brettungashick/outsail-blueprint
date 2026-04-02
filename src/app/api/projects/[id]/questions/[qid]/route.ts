import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, openQuestions } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH /api/projects/[id]/questions/[qid]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; qid: string } }
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
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth || (auth.role !== 'advisor' && auth.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(openQuestions).where(eq(openQuestions.id, params.qid))
  return NextResponse.json({ ok: true })
}

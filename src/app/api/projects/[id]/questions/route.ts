import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, openQuestions } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function verifyAdvisorAccess(req: NextRequest, projectId: string) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth) return null
  if (auth.role !== 'advisor' && auth.role !== 'admin') return null

  const project = await db
    .select({ created_by: projects.created_by })
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

// GET /api/projects/[id]/questions
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const questions = await db
    .select()
    .from(openQuestions)
    .where(eq(openQuestions.project_id, params.id))
    .orderBy(asc(openQuestions.created_at))
    .all()

  return NextResponse.json({ questions })
}

// POST /api/projects/[id]/questions
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { question_text: string; section_id?: string; assigned_to?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.question_text?.trim()) {
    return NextResponse.json({ error: 'question_text required' }, { status: 400 })
  }

  const now = new Date()
  const id = createId()

  await db.insert(openQuestions).values({
    id,
    project_id: params.id,
    section_id: body.section_id ?? null,
    question_text: body.question_text.trim(),
    status: 'open',
    assigned_to: body.assigned_to ?? null,
    created_at: now,
    updated_at: now,
  })

  return NextResponse.json({ id, ok: true }, { status: 201 })
}

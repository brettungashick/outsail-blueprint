import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, decisions } from '@/lib/db/schema'
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

// GET /api/projects/[id]/decisions
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const decs = await db
    .select()
    .from(decisions)
    .where(eq(decisions.project_id, params.id))
    .orderBy(asc(decisions.created_at))
    .all()

  return NextResponse.json({ decisions: decs })
}

// POST /api/projects/[id]/decisions
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    decision_text: string
    rationale?: string
    decision_makers?: string
    decision_date?: string
    section_id?: string
    impact?: string
  }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.decision_text?.trim()) {
    return NextResponse.json({ error: 'decision_text required' }, { status: 400 })
  }

  const now = new Date()
  const id = createId()

  await db.insert(decisions).values({
    id,
    project_id: params.id,
    section_id: body.section_id ?? null,
    decision_text: body.decision_text.trim(),
    rationale: body.rationale,
    decision_makers: body.decision_makers,
    decision_date: body.decision_date ?? new Date().toISOString().split('T')[0],
    impact: body.impact,
    source: 'advisor',
    created_at: now,
    updated_at: now,
  })

  return NextResponse.json({ id, ok: true }, { status: 201 })
}

// DELETE /api/projects/[id]/decisions
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth || (auth.role !== 'advisor' && auth.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { decision_id: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  await db.delete(decisions).where(eq(decisions.id, body.decision_id))
  return NextResponse.json({ ok: true })
}

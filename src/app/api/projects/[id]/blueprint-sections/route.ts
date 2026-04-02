import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function verifyAdvisorAccess(req: NextRequest, projectId: string) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null
  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) return null
  if (authSession.role !== 'advisor' && authSession.role !== 'admin') return null

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
    project.created_by === authSession.userId ||
    members.some((m) => m.user_id === authSession.userId) ||
    authSession.role === 'admin'

  return hasAccess ? authSession : null
}

// GET /api/projects/[id]/blueprint-sections — return full section data including narratives
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sections = await db
    .select()
    .from(blueprintSections)
    .where(eq(blueprintSections.project_id, params.id))
    .all()

  return NextResponse.json({ sections })
}

// PATCH /api/projects/[id]/blueprint-sections — update a single section's narratives or status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdvisorAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    section_id: string
    ai_narrative_current?: string
    ai_narrative_future?: string
    status?: string
    depth?: string
  }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { section_id, ...updates } = body
  if (!section_id) return NextResponse.json({ error: 'section_id required' }, { status: 400 })

  // Verify the section belongs to this project
  const section = await db
    .select({ id: blueprintSections.id })
    .from(blueprintSections)
    .where(eq(blueprintSections.id, section_id))
    .get()

  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date() }
  if (updates.ai_narrative_current !== undefined) patch.ai_narrative_current = updates.ai_narrative_current
  if (updates.ai_narrative_future !== undefined) patch.ai_narrative_future = updates.ai_narrative_future
  if (updates.status !== undefined) patch.status = updates.status
  if (updates.depth !== undefined) patch.depth = updates.depth

  await db
    .update(blueprintSections)
    .set(patch)
    .where(eq(blueprintSections.id, section_id))

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function checkAccess(projectId: string, userId: string): Promise<boolean> {
  const project = await db.select({ id: projects.id, created_by: projects.created_by })
    .from(projects).where(eq(projects.id, projectId)).get()
  if (!project) return false
  const members = await db.select({ user_id: projectMembers.user_id })
    .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()
  return project.created_by === userId || members.some((m) => m.user_id === userId)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const ok = await checkAccess(params.id, session.userId)
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const project = await db.select({ question_guide: projects.question_guide })
      .from(projects).where(eq(projects.id, params.id)).get()
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      guide: project.question_guide ? JSON.parse(project.question_guide) : null,
    })
  } catch (err) {
    console.error('[GET /api/projects/[id]/question-guide]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || !['admin', 'advisor'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const ok = await checkAccess(params.id, session.userId)
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { guide: unknown }
    await db.update(projects)
      .set({ question_guide: JSON.stringify(body.guide), updated_at: new Date() })
      .where(eq(projects.id, params.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/projects/[id]/question-guide]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

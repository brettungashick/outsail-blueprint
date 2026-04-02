import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

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

  const projectId = params.id

  // Access check
  try {
    const project = await db.select({ id: projects.id, created_by: projects.created_by })
      .from(projects).where(eq(projects.id, projectId)).get()
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const memberCheck = await db.select({ user_id: projectMembers.user_id })
      .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()

    const hasAccess = project.created_by === session.userId ||
      memberCheck.some((m) => m.user_id === session.userId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  try {
    const body = await req.json() as {
      scheduling_link?: string | null
      self_service_enabled?: boolean
    }

    const patch: Record<string, unknown> = { updated_at: new Date() }
    if ('scheduling_link' in body) patch.scheduling_link = body.scheduling_link ?? null
    if (typeof body.self_service_enabled === 'boolean') patch.self_service_enabled = body.self_service_enabled

    await db.update(projects).set(patch).where(eq(projects.id, projectId))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/projects/[id]/settings]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

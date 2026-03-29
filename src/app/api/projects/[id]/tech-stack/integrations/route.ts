import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, integrations } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

type IntegrationQuality = 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual'

async function verifyAccess(request: NextRequest, projectId: string) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return null

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) return null

  if (project.created_by !== session.userId) {
    const membership = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.project_id, projectId))
      .all()

    const hasMembership = membership.some((m) => m.user_id === session.userId)
    if (!hasMembership) return null
  }

  return { session, project }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await verifyAccess(request, params.id)
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    integrations: Array<{
      source_id: string
      target_id: string
      quality: IntegrationQuality
    }>
  }

  // Delete all existing integrations for this project
  await db
    .delete(integrations)
    .where(eq(integrations.project_id, params.id))

  // Re-insert new integrations
  if (body.integrations.length > 0) {
    for (const integration of body.integrations) {
      await db.insert(integrations).values({
        project_id: params.id,
        source_system_id: integration.source_id,
        target_system_id: integration.target_id,
        integration_quality: integration.quality,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

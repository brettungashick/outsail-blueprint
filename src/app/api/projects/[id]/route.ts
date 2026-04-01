import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  projects,
  projectMembers,
  chatMessages,
  discoverySessions,
  integrations,
  techStackSystems,
  requirements,
  processes,
  decisions,
  openQuestions,
  blueprintSections,
  generatedOutputs,
  chatContexts,
} from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

// DELETE /api/projects/[id] — delete a project and all its related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'advisor' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const projectId = params.id

  // Verify the project exists and this advisor has access
  const project = await db
    .select({ id: projects.id, created_by: projects.created_by })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const isMember = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .all()

  const hasAccess =
    project.created_by === session.userId ||
    isMember.some(() => true) ||
    session.role === 'admin'

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Delete in FK dependency order (children before parents)
    await db.delete(chatMessages).where(eq(chatMessages.project_id, projectId))
    await db.delete(discoverySessions).where(eq(discoverySessions.project_id, projectId))
    await db.delete(integrations).where(eq(integrations.project_id, projectId))
    await db.delete(techStackSystems).where(eq(techStackSystems.project_id, projectId))
    await db.delete(requirements).where(eq(requirements.project_id, projectId))
    await db.delete(processes).where(eq(processes.project_id, projectId))
    await db.delete(decisions).where(eq(decisions.project_id, projectId))
    await db.delete(openQuestions).where(eq(openQuestions.project_id, projectId))
    await db.delete(blueprintSections).where(eq(blueprintSections.project_id, projectId))
    await db.delete(generatedOutputs).where(eq(generatedOutputs.project_id, projectId))
    await db.delete(chatContexts).where(eq(chatContexts.project_id, projectId))
    await db.delete(projectMembers).where(eq(projectMembers.project_id, projectId))
    await db.delete(projects).where(eq(projects.id, projectId))

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]] Error:', err)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}

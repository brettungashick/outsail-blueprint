import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { generatedOutputs, projectMembers, projects } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { hasProjectAccess } from '@/lib/auth/access'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// The caller must be the project creator, a member, or an admin. Used to scope
// output writes/reads to the specific project rather than any project.
async function hasWriteAccess(
  projectId: string,
  session: { userId: string; role: string }
): Promise<boolean> {
  const project = await db
    .select({ created_by: projects.created_by })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()
  if (!project) return false
  const members = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .all()
  return hasProjectAccess(project, members, session)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; outputId: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return new Response('Unauthorized', { status: 401 })

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id: projectId, outputId } = params

  if (!(await hasWriteAccess(projectId, session))) {
    return new Response('Forbidden', { status: 403 })
  }

  const output = await db
    .select()
    .from(generatedOutputs)
    .where(eq(generatedOutputs.id, outputId))
    .get()

  if (!output || output.project_id !== projectId) {
    return new Response('Not found', { status: 404 })
  }

  return Response.json(output)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; outputId: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return new Response('Unauthorized', { status: 401 })

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return new Response('Unauthorized', { status: 401 })

  if (session.role !== 'advisor' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const { id: projectId, outputId } = params

  if (!(await hasWriteAccess(projectId, session))) {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json() as { content?: string }

  const output = await db
    .select({ id: generatedOutputs.id, project_id: generatedOutputs.project_id })
    .from(generatedOutputs)
    .where(eq(generatedOutputs.id, outputId))
    .get()

  if (!output || output.project_id !== projectId) {
    return new Response('Not found', { status: 404 })
  }

  await db
    .update(generatedOutputs)
    .set({ content: body.content })
    .where(eq(generatedOutputs.id, outputId))

  return Response.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; outputId: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return new Response('Unauthorized', { status: 401 })

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return new Response('Unauthorized', { status: 401 })

  if (session.role !== 'advisor' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const { id: projectId, outputId } = params

  if (!(await hasWriteAccess(projectId, session))) {
    return new Response('Forbidden', { status: 403 })
  }

  const output = await db
    .select({ id: generatedOutputs.id, project_id: generatedOutputs.project_id })
    .from(generatedOutputs)
    .where(eq(generatedOutputs.id, outputId))
    .get()

  if (!output || output.project_id !== projectId) {
    return new Response('Not found', { status: 404 })
  }

  await db.delete(generatedOutputs).where(eq(generatedOutputs.id, outputId))

  return Response.json({ ok: true })
}

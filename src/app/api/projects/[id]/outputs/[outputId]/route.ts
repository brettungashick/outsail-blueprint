import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { generatedOutputs, projectMembers } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

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

  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .get()

  if (!membership && session.role !== 'advisor' && session.role !== 'admin') {
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

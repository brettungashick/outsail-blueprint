import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, generatedOutputs } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return new Response('Unauthorized', { status: 401 })

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const projectId = params.id

  // Verify access (advisor or client member)
  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .get()

  // Advisors/admins can also access via role
  if (!membership && session.role !== 'advisor' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const project = await db
    .select({ id: projects.id, status: projects.status, readiness_level: projects.readiness_level })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) return new Response('Not found', { status: 404 })

  const outputs = await db
    .select({
      id: generatedOutputs.id,
      output_type: generatedOutputs.output_type,
      status: generatedOutputs.status,
      version: generatedOutputs.version,
      format: generatedOutputs.format,
      created_at: generatedOutputs.created_at,
    })
    .from(generatedOutputs)
    .where(eq(generatedOutputs.project_id, projectId))
    .all()

  return Response.json({ outputs, project_status: project.status, readiness_level: project.readiness_level })
}

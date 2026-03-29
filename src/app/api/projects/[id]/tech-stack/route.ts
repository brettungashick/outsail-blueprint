import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, techStackSystems, integrations } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const access = await verifyAccess(request, params.id)
  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const systems = await db
    .select()
    .from(techStackSystems)
    .where(eq(techStackSystems.project_id, params.id))
    .all()

  const ints = await db
    .select()
    .from(integrations)
    .where(eq(integrations.project_id, params.id))
    .all()

  return NextResponse.json({ systems, integrations: ints })
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
    system_name: string
    is_primary: boolean
    modules_used: string[]
    ratings: { admin: number; employee: number; service: number }
    system_type: string | null
    vendor?: string
  }

  const { system_name, is_primary, modules_used, ratings, system_type, vendor } = body

  const avgRating = Math.round((ratings.admin + ratings.employee + ratings.service) / 3)

  const system = await db
    .insert(techStackSystems)
    .values({
      project_id: params.id,
      system_name,
      vendor: vendor ?? system_name,
      system_type: system_type as typeof techStackSystems.$inferInsert['system_type'],
      is_primary,
      modules_used: JSON.stringify(modules_used),
      experience_rating: avgRating,
      notes: JSON.stringify({ ratings }),
    })
    .returning()
    .get()

  return NextResponse.json({ systemId: system.id }, { status: 201 })
}

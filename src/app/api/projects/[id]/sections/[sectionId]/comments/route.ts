import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections, blueprintComments, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function verifyAccess(req: NextRequest, projectId: string) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth) return null

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
    project.created_by === auth.userId ||
    members.some((m) => m.user_id === auth.userId) ||
    auth.role === 'admin'

  return hasAccess ? auth : null
}

// GET /api/projects/[id]/sections/[sectionId]/comments
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const auth = await verifyAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const comments = await db
    .select({
      id: blueprintComments.id,
      content: blueprintComments.content,
      parent_comment_id: blueprintComments.parent_comment_id,
      user_id: blueprintComments.user_id,
      created_at: blueprintComments.created_at,
      user_name: users.name,
      user_email: users.email,
      user_role: users.role,
    })
    .from(blueprintComments)
    .leftJoin(users, eq(blueprintComments.user_id, users.id))
    .where(eq(blueprintComments.section_id, params.sectionId))
    .orderBy(asc(blueprintComments.created_at))
    .all()

  return NextResponse.json({ comments })
}

// POST /api/projects/[id]/sections/[sectionId]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const auth = await verifyAccess(req, params.id)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify section belongs to project
  const section = await db
    .select({ id: blueprintSections.id })
    .from(blueprintSections)
    .where(eq(blueprintSections.id, params.sectionId))
    .get()
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  let body: { content: string; parent_comment_id?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const now = new Date()
  const id = createId()

  await db.insert(blueprintComments).values({
    id,
    project_id: params.id,
    section_id: params.sectionId,
    user_id: auth.userId,
    content: body.content.trim(),
    parent_comment_id: body.parent_comment_id ?? null,
    created_at: now,
    updated_at: now,
  })

  // Return the newly created comment with user info
  const user = await db
    .select({ name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, auth.userId))
    .get()

  return NextResponse.json({
    comment: {
      id,
      content: body.content.trim(),
      parent_comment_id: body.parent_comment_id ?? null,
      user_id: auth.userId,
      created_at: now,
      user_name: user?.name ?? null,
      user_email: user?.email ?? auth.email,
      user_role: user?.role ?? auth.role,
    }
  }, { status: 201 })
}

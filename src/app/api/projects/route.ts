import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

// GET /api/projects — list all projects the session user has access to
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.created_at))
      .all()

    return NextResponse.json({ projects: allProjects }, { status: 200 })
  } catch (err) {
    console.error('[GET /api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      client_company_name,
      client_contact_email,
      headcount,
      tier,
      scope_notes,
    } = body

    if (!name || !client_company_name || !client_contact_email) {
      return NextResponse.json(
        { error: 'name, client_company_name, and client_contact_email are required' },
        { status: 400 }
      )
    }

    const project = await db
      .insert(projects)
      .values({
        name,
        client_company_name,
        client_contact_email,
        headcount: headcount ?? null,
        tier: tier ?? null,
        scope_notes: scope_notes ?? null,
        created_by: session.userId,
        status: 'setup',
      })
      .returning()
      .get()

    return NextResponse.json({ project }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

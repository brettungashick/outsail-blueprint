import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { projects, projectMembers, users, blueprintSections } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME, createMagicToken } from '@/lib/auth'
import { MagicLinkEmail } from '@/lib/email/magic-link'
import type { SectionKey, SectionDepth, ProjectTier } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

// Blueprint section definitions
const BLUEPRINT_SECTIONS: Array<{ key: SectionKey; name: string }> = [
  { key: 'payroll', name: 'Payroll' },
  { key: 'hris', name: 'HRIS & Core HR' },
  { key: 'ats', name: 'ATS & Recruiting' },
  { key: 'lms', name: 'Learning & Development' },
  { key: 'performance', name: 'Performance Management' },
  { key: 'benefits', name: 'Benefits Administration' },
  { key: 'compensation', name: 'Compensation Planning' },
  { key: 'onboarding', name: 'Onboarding & Offboarding' },
]

// Tier → default section depth
const TIER_DEPTH_MAP: Record<ProjectTier, SectionDepth> = {
  essentials: 'light',
  growth: 'standard',
  enterprise: 'deep',
}

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
    // Get projects created by the user
    const createdProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.created_by, session.userId))
      .orderBy(desc(projects.updated_at))
      .all()

    // Get projects where user is a member
    const memberProjectIds = await db
      .select({ project_id: projectMembers.project_id })
      .from(projectMembers)
      .where(eq(projectMembers.user_id, session.userId))
      .all()

    const memberIds = memberProjectIds.map((m) => m.project_id)

    // Fetch member projects (excluding duplicates already in createdProjects)
    let memberProjects: typeof createdProjects = []
    if (memberIds.length > 0) {
      const createdIds = new Set(createdProjects.map((p) => p.id))
      for (const pid of memberIds) {
        if (!createdIds.has(pid)) {
          const p = await db
            .select()
            .from(projects)
            .where(eq(projects.id, pid))
            .get()
          if (p) memberProjects.push(p)
        }
      }
    }

    // Combine and sort by updated_at desc
    const allProjects = [...createdProjects, ...memberProjects].sort((a, b) => {
      const aTime = a.updated_at?.getTime() ?? a.created_at?.getTime() ?? 0
      const bTime = b.updated_at?.getTime() ?? b.created_at?.getTime() ?? 0
      return bTime - aTime
    })

    return NextResponse.json({ projects: allProjects }, { status: 200 })
  } catch (err) {
    console.error('[GET /api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/projects — create a new project with blueprint sections and invite client
export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Require advisor or admin role
  if (session.role !== 'advisor' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const {
      name,
      clientContactEmail,
      headcount,
      scopeNotes,
      tier,
    } = body as {
      name?: string
      clientContactEmail?: string
      headcount?: number
      scopeNotes?: string
      tier?: ProjectTier
    }

    if (!name || !clientContactEmail) {
      return NextResponse.json(
        { error: 'name and clientContactEmail are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = clientContactEmail.toLowerCase().trim()
    const resolvedTier: ProjectTier = tier ?? 'growth'
    const depth = TIER_DEPTH_MAP[resolvedTier]

    // 1. Insert project row
    const project = await db
      .insert(projects)
      .values({
        name,
        client_company_name: name,
        client_contact_email: normalizedEmail,
        headcount: headcount ?? null,
        tier: resolvedTier,
        scope_notes: scopeNotes ?? null,
        created_by: session.userId,
        status: 'setup',
      })
      .returning()
      .get()

    // 2. Insert 8 blueprint_sections rows
    for (const section of BLUEPRINT_SECTIONS) {
      await db.insert(blueprintSections).values({
        project_id: project.id,
        section_key: section.key,
        section_name: section.name,
        depth,
        status: 'not_started',
        completeness_score: 0,
      })
    }

    // 3. Upsert client user by email (role = 'client')
    let clientUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .get()

    if (!clientUser) {
      clientUser = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          role: 'client',
        })
        .returning()
        .get()
    }

    // 4. Add advisor to project_members
    await db.insert(projectMembers).values({
      project_id: project.id,
      user_id: session.userId,
      role: 'advisor',
    })

    // 5. Add client to project_members
    await db.insert(projectMembers).values({
      project_id: project.id,
      user_id: clientUser.id,
      role: 'client',
    })

    // 6. Send invitation email to client
    try {
      const token = await createMagicToken(normalizedEmail)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const magicLinkUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`

      await resend.emails.send({
        from: 'OutSail Blueprint <noreply@outsail.co>',
        to: normalizedEmail,
        subject: 'Your HR Technology Discovery is Ready',
        react: MagicLinkEmail({
          magicLinkUrl,
          userEmail: normalizedEmail,
          isInvitation: true,
          companyName: name,
        }),
      })
    } catch (emailErr) {
      // Non-fatal: log but don't fail the project creation
      console.error('[POST /api/projects] Failed to send invitation email:', emailErr)
    }

    return NextResponse.json({ projectId: project.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

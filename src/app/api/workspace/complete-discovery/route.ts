import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sendNotification } from '@/lib/email/send-notification'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { session_id: string; project_id: string }
  const { session_id, project_id } = body
  if (!session_id || !project_id) {
    return NextResponse.json({ error: 'session_id and project_id required' }, { status: 400 })
  }

  // Verify membership
  const memberCheck = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .all()

  const hasAccess = memberCheck.some((m) => m.project_id === project_id)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Mark session as completed
    await db.update(discoverySessions)
      .set({ status: 'completed', updated_at: new Date() })
      .where(eq(discoverySessions.id, session_id))

    // Load project for email + status update
    const project = await db.select({
      id: projects.id,
      client_company_name: projects.client_company_name,
      status: projects.status,
      created_by: projects.created_by,
    }).from(projects).where(eq(projects.id, project_id)).get()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Update project status to deep_discovery if it's still in an earlier phase
    const earlyStatuses = ['intake', 'discovery_complete', 'summary_approved']
    if (earlyStatuses.includes(project.status)) {
      await db.update(projects)
        .set({ status: 'deep_discovery', updated_at: new Date() })
        .where(eq(projects.id, project_id))
    }

    // Send email to advisor
    if (project.created_by) {
      const advisor = await db.select({ email: users.email, name: users.name })
        .from(users).where(eq(users.id, project.created_by)).get()

      if (advisor?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        try {
          await sendNotification({
            to: advisor.email,
            subject: `${project.client_company_name} completed their self-service discovery`,
            heading: 'Self-Service Discovery Complete',
            body: `${project.client_company_name} has completed their self-service discovery session and is ready for Blueprint generation.`,
            ctaText: 'Review Discovery',
            ctaUrl: `${appUrl}/dashboard/projects/${project_id}`,
          })
        } catch (emailErr) {
          console.error('[complete-discovery] Email send failed:', emailErr)
          // Non-fatal
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/workspace/complete-discovery]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { sendNotification } from '@/lib/email/send-notification'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Verify membership
  const members = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.project_id, params.id))
    .all()

  const isMember =
    project.created_by === authSession.userId ||
    members.some((m) => m.user_id === authSession.userId)

  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { clientEdits: unknown }

  // Save client edits + mark approved
  await db
    .update(projects)
    .set({
      client_edits: JSON.stringify(body.clientEdits),
      summary_approved_at: new Date(),
      status: 'summary_approved',
      updated_at: new Date(),
    })
    .where(eq(projects.id, params.id))

  // Fire-and-forget email to advisor
  try {
    // Find the advisor (project creator)
    const advisorId = project.created_by
    if (advisorId) {
      const advisor = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, advisorId))
        .get()

      if (advisor) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://outsail-blueprint.vercel.app'
        await sendNotification({
          to: advisor.email,
          subject: `${project.client_company_name} completed their discovery summary`,
          heading: 'Client Summary Ready for Review',
          body: `${project.client_company_name} has reviewed and approved their discovery summary. Their priorities and vendor preferences are ready for your review.`,
          ctaText: 'Review Summary',
          ctaUrl: `${appUrl}/dashboard/projects/${project.id}`,
        })
      }
    }
  } catch (emailErr) {
    // Non-fatal
    console.error('[approve-summary] Email error:', emailErr)
  }

  return NextResponse.json({ ok: true })
}

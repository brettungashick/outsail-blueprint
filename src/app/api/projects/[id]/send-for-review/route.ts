import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { sendNotification } from '@/lib/email/send-notification'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authSession.role !== 'advisor' && authSession.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .get()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const members = await db
    .select({ user_id: projectMembers.user_id, role: projectMembers.role })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, params.id))
    .all()

  const hasAccess =
    project.created_by === authSession.userId ||
    members.some((m) => m.user_id === authSession.userId) ||
    authSession.role === 'admin'
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()

  // Update all draft/in_progress sections to sent_to_client
  await db
    .update(blueprintSections)
    .set({ status: 'sent_to_client', updated_at: now })
    .where(eq(blueprintSections.project_id, params.id))

  // Update project status to client_review
  await db
    .update(projects)
    .set({ status: 'client_review', updated_at: now })
    .where(eq(projects.id, params.id))

  // Email the client (client role member)
  try {
    const clientMember = members.find((m) => m.role === 'client')
    let clientEmail: string | null = project.client_contact_email

    if (clientMember) {
      const clientUser = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, clientMember.user_id))
        .get()
      if (clientUser) clientEmail = clientUser.email
    }

    if (clientEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://outsail-blueprint.vercel.app'
      await sendNotification({
        to: clientEmail,
        subject: `Your ${project.client_company_name} Blueprint is ready for review`,
        heading: 'Your Blueprint is Ready',
        body: `Your HR technology Blueprint for ${project.client_company_name} has been prepared by your advisor and is now ready for your review. Please review each section and provide your approval.`,
        ctaText: 'Review Blueprint',
        ctaUrl: `${appUrl}/workspace/blueprint`,
      })
    }
  } catch (emailErr) {
    // Non-fatal
    console.error('[send-for-review] Email error:', emailErr)
  }

  return NextResponse.json({ ok: true })
}

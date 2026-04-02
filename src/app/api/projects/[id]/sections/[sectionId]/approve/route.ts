import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, blueprintSections, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { sendNotification } from '@/lib/email/send-notification'

export const dynamic = 'force-dynamic'

// POST /api/projects/[id]/sections/[sectionId]/approve
// Client-side: marks a section client_approved; if all sections approved, moves project to 'approved'
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const auth = await verifySessionToken(sessionCookie.value)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Clients and advisors can both approve
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .get()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const members = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, params.id))
    .all()

  const hasAccess =
    project.created_by === auth.userId ||
    members.some((m) => m.user_id === auth.userId) ||
    auth.role === 'admin'
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()

  // Approve this section
  await db
    .update(blueprintSections)
    .set({ status: 'client_approved', updated_at: now })
    .where(eq(blueprintSections.id, params.sectionId))

  // Check if ALL sections are now approved
  const allSections = await db
    .select({ id: blueprintSections.id, status: blueprintSections.status })
    .from(blueprintSections)
    .where(eq(blueprintSections.project_id, params.id))
    .all()

  const allApproved = allSections.length > 0 && allSections.every(
    (s) => s.status === 'client_approved' || s.status === 'complete'
  )

  if (allApproved && project.status === 'client_review') {
    await db
      .update(projects)
      .set({ status: 'approved', updated_at: now })
      .where(eq(projects.id, params.id))

    // Email the advisor
    try {
      if (project.created_by) {
        const advisor = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, project.created_by))
          .get()

        if (advisor) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://outsail-blueprint.vercel.app'
          await sendNotification({
            to: advisor.email,
            subject: `${project.client_company_name} approved their Blueprint`,
            heading: 'Blueprint Approved',
            body: `${project.client_company_name} has reviewed and approved all sections of their Blueprint. You can now generate outputs.`,
            ctaText: 'Generate Outputs',
            ctaUrl: `${appUrl}/dashboard/projects/${project.id}`,
          })
        }
      }
    } catch (emailErr) {
      console.error('[approve-section] Email error:', emailErr)
    }

    return NextResponse.json({ ok: true, project_approved: true, approved_count: allSections.length })
  }

  const approvedCount = allSections.filter(
    (s) => s.id === params.sectionId ? true : (s.status === 'client_approved' || s.status === 'complete')
  ).length

  return NextResponse.json({ ok: true, project_approved: false, approved_count: approvedCount, total: allSections.length })
}

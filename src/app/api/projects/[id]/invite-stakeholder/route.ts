import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions, users } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME, createMagicToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { MagicLinkEmail } from '@/lib/email/magic-link'
import * as React from 'react'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || !['admin', 'advisor'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const projectId = params.id

  // Access check
  try {
    const project = await db.select({
      id: projects.id,
      created_by: projects.created_by,
      client_company_name: projects.client_company_name,
    }).from(projects).where(eq(projects.id, projectId)).get()

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const members = await db.select({ user_id: projectMembers.user_id })
      .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()

    const hasAccess = project.created_by === session.userId ||
      members.some((m) => m.user_id === session.userId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      name: string
      email: string
      role: string
      focus_areas: string[]
    }

    if (!body.email || !body.name) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
    }

    // Upsert stakeholder user (role: client)
    let stakeholderUser = await db.select({ id: users.id, email: users.email })
      .from(users).where(eq(users.email, body.email.toLowerCase())).get()

    if (!stakeholderUser) {
      const newId = createId()
      await db.insert(users).values({
        id: newId,
        email: body.email.toLowerCase(),
        name: body.name,
        role: 'client',
      })
      stakeholderUser = { id: newId, email: body.email.toLowerCase() }
    }

    // Add to project_members if not already present
    const allMembers = await db.select({ user_id: projectMembers.user_id })
      .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()

    if (!allMembers.some((m) => m.user_id === stakeholderUser!.id)) {
      await db.insert(projectMembers).values({
        id: createId(),
        project_id: projectId,
        user_id: stakeholderUser.id,
        role: 'viewer',
        invited_at: new Date(),
      })
    }

    // Create deep_discovery session
    const newSessionId = createId()
    await db.insert(discoverySessions).values({
      id: newSessionId,
      project_id: projectId,
      session_type: 'deep_discovery',
      status: 'active',
      participant_name: body.name,
      participant_role: body.role || undefined,
      participant_email: body.email.toLowerCase(),
      focus_areas: body.focus_areas?.length ? JSON.stringify(body.focus_areas) : undefined,
      created_by: session.userId,
    })

    // Send magic link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const token = await createMagicToken(body.email.toLowerCase())
    const magicLinkUrl = `${appUrl}/api/auth/verify?token=${token}`

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'OutSail Blueprint <noreply@hrisblueprint.com>',
        to: body.email,
        subject: `You've been invited to join the ${project.client_company_name} discovery session`,
        react: React.createElement(MagicLinkEmail, {
          magicLinkUrl,
          userEmail: body.email,
          isInvitation: true,
          companyName: project.client_company_name,
        }),
      })
    } catch (emailErr) {
      console.error('[invite-stakeholder] Email send failed:', emailErr)
      // Non-fatal: session was created, just log the error
    }

    return NextResponse.json({ ok: true, sessionId: newSessionId })
  } catch (err) {
    console.error('[POST /api/projects/[id]/invite-stakeholder]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

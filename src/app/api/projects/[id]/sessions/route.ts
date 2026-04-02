import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, and, isNotNull } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions, chatMessages } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = params.id

  // Access check
  try {
    const project = await db.select({ id: projects.id, created_by: projects.created_by })
      .from(projects).where(eq(projects.id, projectId)).get()
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const memberCheck = await db.select({ user_id: projectMembers.user_id })
      .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()

    const hasAccess = project.created_by === session.userId ||
      memberCheck.some((m) => m.user_id === session.userId)
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  try {
    const sessions = await db
      .select({
        id: discoverySessions.id,
        session_type: discoverySessions.session_type,
        status: discoverySessions.status,
        session_label: discoverySessions.session_label,
        session_date: discoverySessions.session_date,
        attendees: discoverySessions.attendees,
        participant_name: discoverySessions.participant_name,
        participant_role: discoverySessions.participant_role,
        participant_email: discoverySessions.participant_email,
        focus_areas: discoverySessions.focus_areas,
        processing_status: discoverySessions.processing_status,
        session_summary: discoverySessions.session_summary,
        transcript_extractions: discoverySessions.transcript_extractions,
        created_at: discoverySessions.created_at,
        updated_at: discoverySessions.updated_at,
      })
      .from(discoverySessions)
      .where(eq(discoverySessions.project_id, projectId))
      .orderBy(desc(discoverySessions.created_at))
      .all()

    // Count extractions per session
    const sessionIds = sessions.map((s) => s.id)
    const extractionCounts: Record<string, number> = {}

    for (const sid of sessionIds) {
      const msgs = await db
        .select({ extractions: chatMessages.extractions })
        .from(chatMessages)
        .where(and(
          eq(chatMessages.session_id, sid),
          isNotNull(chatMessages.extractions)
        ))
        .all()

      let count = 0
      for (const m of msgs) {
        if (m.extractions) {
          try {
            const ext = JSON.parse(m.extractions) as Record<string, unknown>
            for (const v of Object.values(ext)) {
              if (Array.isArray(v)) count += v.length
            }
          } catch { /* skip */ }
        }
      }
      extractionCounts[sid] = count
    }

    const result = sessions.map((s) => {
      // For transcript sessions, count from transcript_extractions JSON
      let transcriptCount = 0
      if (s.session_type === 'transcript' && s.transcript_extractions) {
        try {
          const te = JSON.parse(s.transcript_extractions) as { extractions?: Array<{ status: string }> }
          transcriptCount = te.extractions?.filter((e) => e.status !== 'discarded').length ?? 0
        } catch { /* skip */ }
      }
      return {
        ...s,
        extraction_count: s.session_type === 'transcript' ? transcriptCount : (extractionCounts[s.id] ?? 0),
      }
    })

    return NextResponse.json({ sessions: result })
  } catch (err) {
    console.error('[GET /api/projects/[id]/sessions]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

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
  const project = await db.select({ id: projects.id, created_by: projects.created_by })
    .from(projects).where(eq(projects.id, projectId)).get()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await db.select({ user_id: projectMembers.user_id })
    .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()
  const hasAccess = project.created_by === session.userId || members.some((m) => m.user_id === session.userId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json() as {
      session_label?: string
      session_date?: string
      attendees?: Array<{ name: string; role: string }>
      transcript_raw?: string
    }

    const newSession = await db.insert(discoverySessions).values({
      id: createId(),
      project_id: projectId,
      session_type: 'transcript',
      status: 'active',
      session_label: body.session_label ?? null,
      session_date: body.session_date ?? null,
      attendees: body.attendees ? JSON.stringify(body.attendees) : null,
      transcript_raw: body.transcript_raw ?? null,
      processing_status: 'pending',
      created_by: session.userId,
    }).returning().get()

    return NextResponse.json({ session: newSession }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/sessions]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

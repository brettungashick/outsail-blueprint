import { NextRequest, NextResponse } from 'next/server'
import { eq, desc, and, isNotNull } from 'drizzle-orm'
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
        participant_name: discoverySessions.participant_name,
        participant_role: discoverySessions.participant_role,
        participant_email: discoverySessions.participant_email,
        focus_areas: discoverySessions.focus_areas,
        processing_status: discoverySessions.processing_status,
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

    const result = sessions.map((s) => ({
      ...s,
      extraction_count: extractionCounts[s.id] ?? 0,
    }))

    return NextResponse.json({ sessions: result })
  } catch (err) {
    console.error('[GET /api/projects/[id]/sessions]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

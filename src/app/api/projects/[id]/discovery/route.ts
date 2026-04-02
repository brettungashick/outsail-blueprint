import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, isNotNull } from 'drizzle-orm'
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
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = params.id

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
    // Fetch all sessions
    const sessions = await db
      .select({
        id: discoverySessions.id,
        session_type: discoverySessions.session_type,
        status: discoverySessions.status,
        participant_name: discoverySessions.participant_name,
        participant_role: discoverySessions.participant_role,
        created_at: discoverySessions.created_at,
      })
      .from(discoverySessions)
      .where(eq(discoverySessions.project_id, projectId))
      .orderBy(asc(discoverySessions.created_at))
      .all()

    // Fetch all messages ordered by session then time
    const messages = await db
      .select({
        id: chatMessages.id,
        session_id: chatMessages.session_id,
        role: chatMessages.role,
        content: chatMessages.content,
        extractions: chatMessages.extractions,
        created_at: chatMessages.created_at,
      })
      .from(chatMessages)
      .where(eq(chatMessages.project_id, projectId))
      .orderBy(asc(chatMessages.created_at))
      .all()

    // Aggregate extractions across all messages
    const allExtractions: {
      pain_points: Array<{ description: string; severity: string; related_system?: string }>
      priorities: Array<{ priority: string; rank: number }>
      vendors_staying: Array<{ name: string; reason?: string }>
      vendors_replacing: Array<{ name: string; reason?: string }>
      complexity_signals: Array<{ area: string; description: string; severity: string }>
    } = {
      pain_points: [],
      priorities: [],
      vendors_staying: [],
      vendors_replacing: [],
      complexity_signals: [],
    }

    for (const msg of messages) {
      if (!msg.extractions) continue
      try {
        const ext = JSON.parse(msg.extractions) as Record<string, unknown>
        if (Array.isArray(ext.pain_points)) allExtractions.pain_points.push(...(ext.pain_points as typeof allExtractions.pain_points))
        if (Array.isArray(ext.priorities)) allExtractions.priorities.push(...(ext.priorities as typeof allExtractions.priorities))
        if (Array.isArray(ext.vendors_staying)) allExtractions.vendors_staying.push(...(ext.vendors_staying as typeof allExtractions.vendors_staying))
        if (Array.isArray(ext.vendors_replacing)) allExtractions.vendors_replacing.push(...(ext.vendors_replacing as typeof allExtractions.vendors_replacing))
        if (Array.isArray(ext.complexity_signals)) allExtractions.complexity_signals.push(...(ext.complexity_signals as typeof allExtractions.complexity_signals))
      } catch { /* skip */ }
    }

    // Deduplicate by description
    const dedupe = <T extends { description?: string; priority?: string; name?: string; area?: string }>(arr: T[]): T[] => {
      const seen = new Set<string>()
      return arr.filter((item) => {
        const key = item.description ?? item.priority ?? item.name ?? item.area ?? JSON.stringify(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    allExtractions.pain_points = dedupe(allExtractions.pain_points)
    allExtractions.priorities = dedupe(allExtractions.priorities)
    allExtractions.vendors_staying = dedupe(allExtractions.vendors_staying)
    allExtractions.vendors_replacing = dedupe(allExtractions.vendors_replacing)
    allExtractions.complexity_signals = dedupe(allExtractions.complexity_signals)

    return NextResponse.json({
      sessions,
      messages: messages.map((m) => ({ ...m, extractions: undefined })), // strip raw extractions from messages
      extractions: allExtractions,
    })
  } catch (err) {
    console.error('[GET /api/projects/[id]/discovery]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

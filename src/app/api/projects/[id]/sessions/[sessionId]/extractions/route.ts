import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, discoverySessions } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'
import type { TranscriptExtractions, TranscriptExtraction } from '@/app/api/ai/process-transcript/route'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession || !['admin', 'advisor'].includes(authSession.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: projectId, sessionId } = params

  // Access check
  const project = await db.select({ id: projects.id, created_by: projects.created_by })
    .from(projects).where(eq(projects.id, projectId)).get()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await db.select({ user_id: projectMembers.user_id })
    .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()
  const hasAccess = project.created_by === authSession.userId || members.some((m) => m.user_id === authSession.userId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dbSession = await db.select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .get()
  if (!dbSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!dbSession.transcript_extractions) return NextResponse.json({ error: 'No extractions to update' }, { status: 400 })

  const body = await req.json() as {
    extraction_id?: string
    action?: 'approve' | 'discard' | 'approve_all_high'
    edited_content?: string
  }

  let parsed: TranscriptExtractions
  try {
    parsed = JSON.parse(dbSession.transcript_extractions) as TranscriptExtractions
  } catch {
    return NextResponse.json({ error: 'Failed to parse extractions' }, { status: 500 })
  }

  if (body.action === 'approve_all_high') {
    parsed.extractions = parsed.extractions.map((e: TranscriptExtraction) =>
      e.confidence === 'high' && e.status === 'pending' ? { ...e, status: 'approved' as const } : e
    )
  } else if (body.extraction_id && body.action) {
    parsed.extractions = parsed.extractions.map((e: TranscriptExtraction) => {
      if (e.id !== body.extraction_id) return e
      if (body.action === 'approve') {
        return {
          ...e,
          status: 'approved' as const,
          ...(body.edited_content ? { content: body.edited_content } : {}),
        }
      }
      if (body.action === 'discard') return { ...e, status: 'discarded' as const }
      return e
    })
  } else {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Check if all extractions are handled (approved or discarded)
  const allHandled = parsed.extractions.every(
    (e: TranscriptExtraction) => e.status === 'approved' || e.status === 'discarded'
  )

  await db.update(discoverySessions)
    .set({
      transcript_extractions: JSON.stringify(parsed),
      processing_status: allHandled ? 'complete' : 'review',
      status: allHandled ? 'completed' : 'active',
      updated_at: new Date(),
    })
    .where(eq(discoverySessions.id, sessionId))

  return NextResponse.json({ extractions: parsed, all_handled: allHandled })
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

// Old status → new status mapping
const STATUS_MAP: Record<string, string> = {
  setup: 'intake',
  chat: 'discovery_complete',
  review: 'client_review',
  complete: 'outputs',
}

// POST /api/migrate-status — one-time migration of old project status values
// Requires admin role
export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const allProjects = await db.select({ id: projects.id, status: projects.status }).from(projects).all()

    let migratedCount = 0
    for (const project of allProjects) {
      const newStatus = STATUS_MAP[project.status]
      if (newStatus) {
        await db
          .update(projects)
          .set({ status: newStatus as typeof project.status })
          .where(eq(projects.id, project.id))
        migratedCount++
      }
    }

    return NextResponse.json({
      success: true,
      total: allProjects.length,
      migrated: migratedCount,
    })
  } catch (err) {
    console.error('[POST /api/migrate-status] Error:', err)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}

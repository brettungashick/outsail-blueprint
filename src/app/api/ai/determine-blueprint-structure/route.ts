import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, projectMembers, chatMessages } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

// ── Types ──────────────────────────────────────────────────────────────────

interface RecommendedSection {
  key: string
  title: string
  recommended_depth: 'light' | 'standard' | 'deep'
  discovery_priority: 'critical' | 'high' | 'medium' | 'low'
  notes: string
}

interface DiscoverySummary {
  overview: string
  pain_points: Array<{ description: string; severity: string }>
  priorities: Array<{ priority: string; rank: number }>
  vendors_staying: Array<{ name: string; reason?: string }>
  vendors_replacing: Array<{ name: string; reason?: string }>
  project_params: {
    go_live_date?: string
    budget_status?: string
    decision_team?: string
  }
  complexity_signals: Array<{ area: string; description: string; severity: string }>
}

// ── POST /api/ai/determine-blueprint-structure ─────────────────────────────

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
  }

  const body = await request.json() as { sessionId: string; projectId: string }
  const { sessionId, projectId } = body

  if (!sessionId || !projectId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify access
  const memberCheck = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .all()

  if (!memberCheck.some((m) => m.project_id === projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Load all chat messages from this session
  const msgs = await db
    .select({ role: chatMessages.role, content: chatMessages.content, extractions: chatMessages.extractions })
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionId))
    .orderBy(asc(chatMessages.created_at))
    .all()

  const conversationText = msgs
    .map((m) => `${m.role === 'assistant' ? 'Consultant' : 'Client'}: ${m.content}`)
    .join('\n\n')

  // Aggregate extractions from all messages
  const allExtractions = msgs
    .filter((m) => m.extractions)
    .map((m) => {
      try { return JSON.parse(m.extractions!) as Record<string, unknown> } catch { return null }
    })
    .filter(Boolean)

  const lastExtraction = allExtractions[allExtractions.length - 1] ?? {}

  const systemPrompt = `You are an expert HR technology consultant analyzing a discovery conversation to design a Blueprint structure.

Available Blueprint sections:
- payroll: Payroll & Tax Processing
- hris: HRIS & Core HR
- ats: ATS & Recruiting
- lms: Learning & Development
- performance: Performance Management
- benefits: Benefits Administration
- compensation: Compensation Planning
- onboarding: Onboarding & Offboarding

Tier context: ${project.tier ?? 'growth'}
Company: ${project.client_company_name} (${project.headcount ?? 'unknown'} employees)

Based on the discovery conversation, recommend which sections to include and at what depth.
depth guide: light = high-level fit analysis | standard = detailed requirements | deep = full process mapping + integrations

Return ONLY valid JSON with exactly this structure, no other text:
{
  "sections": [
    {
      "key": "payroll",
      "title": "Payroll & Tax Processing",
      "recommended_depth": "standard",
      "discovery_priority": "critical",
      "notes": "Brief reason for inclusion and depth choice"
    }
  ],
  "summary": {
    "overview": "2-3 sentence synthesis of what was learned",
    "pain_points": [{"description": "...", "severity": "high|medium|low"}],
    "priorities": [{"priority": "...", "rank": 1}],
    "vendors_staying": [{"name": "...", "reason": "..."}],
    "vendors_replacing": [{"name": "...", "reason": "..."}],
    "project_params": {
      "go_live_date": null,
      "budget_status": null,
      "decision_team": null
    },
    "complexity_signals": [{"area": "...", "description": "...", "severity": "high|medium|low"}]
  }
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        stream: false,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Discovery conversation:\n\n${conversationText}\n\nLatest extractions: ${JSON.stringify(lastExtraction)}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error ${response.status}: ${err}`)
    }

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> }
    const text = data.content[0]?.text ?? ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const parsed = JSON.parse(match[0]) as {
      sections: RecommendedSection[]
      summary: DiscoverySummary
    }

    // Save to project record
    await db
      .update(projects)
      .set({
        recommended_sections: JSON.stringify(parsed.sections),
        discovery_summary: JSON.stringify(parsed.summary),
        status: 'discovery_complete',
        updated_at: new Date(),
      })
      .where(eq(projects.id, projectId))

    return NextResponse.json({
      ok: true,
      sections: parsed.sections,
      summary: parsed.summary,
    })
  } catch (err) {
    console.error('[determine-blueprint-structure] Error:', err)
    return NextResponse.json(
      { error: 'Failed to generate Blueprint structure' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  projects,
  projectMembers,
  discoverySessions,
  chatMessages,
  techStackSystems,
  integrations,
} from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
// Transcript processing can take a while
export const maxDuration = 120

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

export interface TranscriptExtraction {
  id: string
  type: 'requirement' | 'process' | 'decision' | 'question'
  section: string
  content: string
  source_quote: string
  confidence: 'high' | 'medium' | 'low'
  criticality?: 'must_have' | 'should_have' | 'could_have' | 'wont_have'
  process_name?: string
  steps?: string[]
  made_by?: string
  status: 'pending' | 'approved' | 'discarded'
}

export interface TranscriptConflict {
  section: string
  existing: string
  new_extraction: string
  extraction_id: string
}

export interface DepthSuggestion {
  section: string
  current: string
  suggested: string
  reason: string
}

export interface TranscriptExtractions {
  extractions: TranscriptExtraction[]
  conflicts: TranscriptConflict[]
  depth_suggestions: DepthSuggestion[]
  session_summary: string
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession || !['admin', 'advisor'].includes(authSession.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const body = await req.json() as { session_id: string; project_id: string }
  const { session_id, project_id } = body
  if (!session_id || !project_id) {
    return NextResponse.json({ error: 'session_id and project_id required' }, { status: 400 })
  }

  // Access check
  const project = await db.select({
    id: projects.id,
    created_by: projects.created_by,
    client_company_name: projects.client_company_name,
    headcount: projects.headcount,
    tier: projects.tier,
    scope_notes: projects.scope_notes,
    discovery_summary: projects.discovery_summary,
    recommended_sections: projects.recommended_sections,
    client_edits: projects.client_edits,
  }).from(projects).where(eq(projects.id, project_id)).get()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await db.select({ user_id: projectMembers.user_id })
    .from(projectMembers).where(eq(projectMembers.project_id, project_id)).all()
  const hasAccess = project.created_by === authSession.userId || members.some((m) => m.user_id === authSession.userId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Load the target session
  const targetSession = await db.select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, session_id))
    .get()

  if (!targetSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!targetSession.transcript_raw) return NextResponse.json({ error: 'No transcript to process' }, { status: 400 })

  // Mark as processing
  await db.update(discoverySessions)
    .set({ processing_status: 'processing', updated_at: new Date() })
    .where(eq(discoverySessions.id, session_id))

  try {
    // Gather project context
    const systems = await db.select({
      system_name: techStackSystems.system_name,
      vendor: techStackSystems.vendor,
      is_primary: techStackSystems.is_primary,
      system_type: techStackSystems.system_type,
      modules_used: techStackSystems.modules_used,
    }).from(techStackSystems).where(eq(techStackSystems.project_id, project_id)).all()

    const integrationRows = await db.select({
      source_system_id: integrations.source_system_id,
      target_system_id: integrations.target_system_id,
      integration_quality: integrations.integration_quality,
    }).from(integrations).where(eq(integrations.project_id, project_id)).all()

    // Gather extractions from prior sessions
    const priorSessions = await db.select({ id: discoverySessions.id, session_type: discoverySessions.session_type, transcript_extractions: discoverySessions.transcript_extractions })
      .from(discoverySessions)
      .where(eq(discoverySessions.project_id, project_id))
      .all()

    const chatExtractions: string[] = []
    for (const s of priorSessions) {
      if (s.id === session_id) continue
      if (s.session_type !== 'transcript') {
        const msgs = await db.select({ extractions: chatMessages.extractions })
          .from(chatMessages)
          .where(eq(chatMessages.session_id, s.id))
          .orderBy(asc(chatMessages.created_at))
          .all()
        for (const m of msgs) {
          if (m.extractions) chatExtractions.push(m.extractions)
        }
      } else if (s.transcript_extractions) {
        chatExtractions.push(s.transcript_extractions)
      }
    }

    // Build context strings
    const techStackDesc = systems.length
      ? systems.map((s) => {
          const mods = s.modules_used ? (() => { try { return (JSON.parse(s.modules_used!) as string[]).join(', ') } catch { return '' } })() : ''
          return `- ${s.system_name}${s.vendor ? ` (${s.vendor})` : ''}${s.is_primary ? ' [PRIMARY]' : ''}${mods ? ` — modules: ${mods}` : ''}`
        }).join('\n')
      : 'No tech stack captured'

    const integrationsDesc = integrationRows.length
      ? `${integrationRows.length} integration(s) mapped`
      : 'No integrations mapped'

    let discoverySummaryText = 'Not yet generated'
    if (project.discovery_summary) {
      try {
        const ds = JSON.parse(project.discovery_summary) as {
          overview?: string
          pain_points?: Array<{ description?: string }>
          complexity_signals?: Array<{ area?: string; description?: string }>
        }
        const parts: string[] = []
        if (ds.overview) parts.push(ds.overview)
        if (ds.pain_points?.length) parts.push(`Pain points: ${ds.pain_points.map((p) => p.description).join('; ')}`)
        if (ds.complexity_signals?.length) parts.push(`Complexity: ${ds.complexity_signals.map((c) => `${c.area}: ${c.description}`).join('; ')}`)
        discoverySummaryText = parts.join('\n')
      } catch { discoverySummaryText = project.discovery_summary }
    }

    let sectionsText = 'No sections defined'
    if (project.recommended_sections) {
      try {
        const rs = JSON.parse(project.recommended_sections) as Array<{ key?: string; name?: string; title?: string; depth?: string; recommended_depth?: string }>
        sectionsText = rs.map((s) => `- ${s.name ?? s.title ?? s.key ?? 'Unknown'} (depth: ${s.depth ?? s.recommended_depth ?? 'standard'})`).join('\n')
      } catch { /* skip */ }
    }

    const priorExtractionsText = chatExtractions.length
      ? `Prior sessions contain ${chatExtractions.length} extraction record(s). Key data already captured.`
      : 'No prior extractions.'

    // Session metadata
    const sessionMetadata = [
      targetSession.session_label ? `Session type: ${targetSession.session_label}` : '',
      targetSession.session_date ? `Date: ${targetSession.session_date}` : '',
      targetSession.attendees ? (() => {
        try {
          const att = JSON.parse(targetSession.attendees!) as Array<{ name: string; role: string }>
          return `Attendees: ${att.map((a) => `${a.name} (${a.role})`).join(', ')}`
        } catch { return '' }
      })() : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `You are an expert HCM implementation consultant processing a discovery call transcript. Your job is to extract structured requirements, processes, decisions, and open questions — then map each to the project's recommended Blueprint sections.

For each extraction:
- Assign a unique id like "ext_001", "ext_002", etc.
- Classify as: requirement, process, decision, or question
- Map to the nearest Blueprint section by name (use exact section names from the list provided)
- Include the exact source quote from the transcript that supports this extraction
- Rate confidence: high (explicit, clear statement), medium (implied, needs confirmation), low (inferred, uncertain)
- For requirements: set criticality as must_have, should_have, could_have, or wont_have
- For processes: include process_name and steps array
- For decisions: include made_by (person/role who stated it)
- Flag conflicts with prior data
- Suggest depth changes for sections that revealed more complexity than expected

Be thorough — extract every meaningful requirement, process, decision, and open question. Err on the side of inclusion.

Respond ONLY with valid JSON matching this exact structure:
{
  "extractions": [
    {
      "id": "ext_001",
      "type": "requirement",
      "section": "Payroll",
      "content": "System must support bi-weekly payroll runs for 450 employees across 3 states",
      "source_quote": "We run payroll every two weeks for about 450 people, and we have employees in California, Texas, and New York",
      "confidence": "high",
      "criticality": "must_have",
      "status": "pending"
    }
  ],
  "conflicts": [
    {
      "section": "HRIS",
      "existing": "Previously captured: planning to stay on Workday",
      "new_extraction": "Transcript suggests moving away from Workday due to cost",
      "extraction_id": "ext_007"
    }
  ],
  "depth_suggestions": [
    {
      "section": "Payroll",
      "current": "standard",
      "suggested": "deep",
      "reason": "Call revealed multi-state complexity, union rules, and custom deduction needs"
    }
  ],
  "session_summary": "2-3 sentence summary of the call covering the main topics discussed and key outcomes"
}`

    const userPrompt = `CLIENT: ${project.client_company_name}
Headcount: ${project.headcount ?? 'Unknown'} | Tier: ${project.tier ?? 'Unknown'}
${sessionMetadata}

TECH STACK:
${techStackDesc}
Integrations: ${integrationsDesc}

DISCOVERY SUMMARY (from quick chat):
${discoverySummaryText}

RECOMMENDED BLUEPRINT SECTIONS:
${sectionsText}

PRIOR EXTRACTIONS CONTEXT:
${priorExtractionsText}

TRANSCRIPT TO PROCESS:
${targetSession.transcript_raw.length > 12000 ? targetSession.transcript_raw.slice(0, 12000) + '\n[transcript truncated]' : targetSession.transcript_raw}

Extract all requirements, processes, decisions, and open questions from this transcript. Map each to the Blueprint sections listed above.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[process-transcript] Anthropic error:', errText)
      await db.update(discoverySessions)
        .set({ processing_status: 'failed', updated_at: new Date() })
        .where(eq(discoverySessions.id, session_id))
      return NextResponse.json({ error: 'AI processing failed' }, { status: 502 })
    }

    const aiData = await response.json() as { content: Array<{ type: string; text?: string }> }
    const rawText = aiData.content.find((c) => c.type === 'text')?.text ?? ''

    let result: TranscriptExtractions
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      result = JSON.parse(jsonMatch[0]) as TranscriptExtractions
    } catch {
      console.error('[process-transcript] JSON parse failed:', rawText.slice(0, 500))
      await db.update(discoverySessions)
        .set({ processing_status: 'failed', updated_at: new Date() })
        .where(eq(discoverySessions.id, session_id))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    // Ensure all extractions have status: 'pending'
    result.extractions = result.extractions.map((e) => ({ ...e, status: 'pending' as const }))

    // Save to session
    await db.update(discoverySessions)
      .set({
        processing_status: 'review',
        session_summary: result.session_summary,
        transcript_extractions: JSON.stringify(result),
        updated_at: new Date(),
      })
      .where(eq(discoverySessions.id, session_id))

    return NextResponse.json({ result })
  } catch (err) {
    console.error('[POST /api/ai/process-transcript]', err)
    await db.update(discoverySessions)
      .set({ processing_status: 'failed', updated_at: new Date() })
      .where(eq(discoverySessions.id, session_id))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

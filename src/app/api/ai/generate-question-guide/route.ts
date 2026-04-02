import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  projects,
  projectMembers,
  discoverySessions,
  chatMessages,
  techStackSystems,
} from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

interface QuestionGuideSection {
  section_key: string
  section_name: string
  context: string
  already_captured: string
  areas_to_probe: string[]
  questions: string[]
  time_allocation: string
  advisor_notes: string
}

interface QuestionGuide {
  sections: QuestionGuideSection[]
  generated_at: string
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifySessionToken(sessionCookie.value)
  if (!session || !['admin', 'advisor'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const body = await req.json() as { projectId: string }
  const { projectId } = body
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

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
  }).from(projects).where(eq(projects.id, projectId)).get()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await db.select({ user_id: projectMembers.user_id })
    .from(projectMembers).where(eq(projectMembers.project_id, projectId)).all()

  const hasAccess = project.created_by === session.userId ||
    members.some((m) => m.user_id === session.userId)
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Gather context
  const systems = await db.select({
    system_name: techStackSystems.system_name,
    vendor: techStackSystems.vendor,
    is_primary: techStackSystems.is_primary,
    system_type: techStackSystems.system_type,
    modules_used: techStackSystems.modules_used,
  }).from(techStackSystems).where(eq(techStackSystems.project_id, projectId)).all()

  const discSessions = await db.select({ id: discoverySessions.id })
    .from(discoverySessions)
    .where(eq(discoverySessions.project_id, projectId))
    .all()

  const allMessages = []
  for (const s of discSessions) {
    const msgs = await db.select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.session_id, s.id))
      .orderBy(asc(chatMessages.created_at))
      .all()
    allMessages.push(...msgs)
  }

  // Build prompt context
  const techStackDesc = systems.length
    ? systems.map((s) => {
        const mods = s.modules_used ? (() => { try { return (JSON.parse(s.modules_used!) as string[]).join(', ') } catch { return '' } })() : ''
        return `- ${s.system_name}${s.vendor ? ` (${s.vendor})` : ''}${s.is_primary ? ' [PRIMARY]' : ''}${mods ? ` — modules: ${mods}` : ''}`
      }).join('\n')
    : 'No tech stack captured yet'

  const transcript = allMessages.length
    ? allMessages.map((m) => `${m.role === 'user' ? 'CLIENT' : 'AI'}: ${m.content}`).join('\n\n')
    : 'No discovery chat transcript yet'

  let discoverySummaryText = 'Not yet generated'
  if (project.discovery_summary) {
    try {
      const ds = JSON.parse(project.discovery_summary) as {
        overview?: string
        pain_points?: Array<{ description?: string }>
        vendors_staying?: Array<{ name?: string }>
        vendors_replacing?: Array<{ name?: string }>
        complexity_signals?: Array<{ area?: string; description?: string }>
      }
      const lines = []
      if (ds.overview) lines.push(`Overview: ${ds.overview}`)
      if (ds.pain_points?.length) lines.push(`Pain points: ${ds.pain_points.map((p) => p.description).join('; ')}`)
      if (ds.vendors_staying?.length) lines.push(`Staying: ${ds.vendors_staying.map((v) => v.name).join(', ')}`)
      if (ds.vendors_replacing?.length) lines.push(`Replacing: ${ds.vendors_replacing.map((v) => v.name).join(', ')}`)
      if (ds.complexity_signals?.length) lines.push(`Complexity: ${ds.complexity_signals.map((c) => `${c.area}: ${c.description}`).join('; ')}`)
      discoverySummaryText = lines.join('\n')
    } catch { /* use raw */ discoverySummaryText = project.discovery_summary }
  }

  let recommendedSectionsText = 'No sections defined yet'
  let sectionsForGuide: Array<{ key: string; name: string; depth: string }> = []
  if (project.recommended_sections) {
    try {
      const rs = JSON.parse(project.recommended_sections) as Array<{ key?: string; section_key?: string; name?: string; section_name?: string; depth?: string }>
      sectionsForGuide = rs.map((s) => ({
        key: s.key ?? s.section_key ?? '',
        name: s.name ?? s.section_name ?? s.key ?? s.section_key ?? '',
        depth: s.depth ?? 'standard',
      }))
      recommendedSectionsText = sectionsForGuide.map((s) => `- ${s.name} (depth: ${s.depth})`).join('\n')
    } catch { /* skip */ }
  }

  let clientEditsText = 'None'
  if (project.client_edits) {
    try {
      const ce = JSON.parse(project.client_edits) as {
        corrections?: string
        anything_else?: string
        section_flags?: Array<{ section?: string; priority?: string; comment?: string }>
      }
      const parts = []
      if (ce.corrections) parts.push(`Corrections: ${ce.corrections}`)
      if (ce.anything_else) parts.push(`Additional context: ${ce.anything_else}`)
      if (ce.section_flags?.length) {
        parts.push(`Section flags: ${ce.section_flags.map((f) => `${f.section} (${f.priority}): ${f.comment}`).join('; ')}`)
      }
      clientEditsText = parts.join('\n') || 'None'
    } catch { /* skip */ }
  }

  const systemPrompt = `You are an expert HCM implementation consultant preparing a deep discovery question guide for an advisor. Your job is to create a structured, practical question guide organized by Blueprint section.

For each section, generate:
- "context": 1-2 sentences about what this section covers and why it matters
- "already_captured": What was learned in the quick discovery chat (be specific or say "not yet discussed")
- "areas_to_probe": 3-5 key areas that need deeper exploration (bullet points)
- "questions": 8-15 specific, open-ended discovery questions — mix of process questions, pain point questions, and future-state questions
- "time_allocation": Estimated time for this section (e.g., "~15 minutes")

Questions should feel like a skilled consultant's conversation — natural, insightful, not interrogating. Mix broad openers with specific probes.

Respond ONLY with valid JSON matching this exact structure:
{
  "sections": [
    {
      "section_key": "payroll",
      "section_name": "Payroll Processing",
      "context": "...",
      "already_captured": "...",
      "areas_to_probe": ["...", "..."],
      "questions": ["...", "..."],
      "time_allocation": "~15 minutes",
      "advisor_notes": ""
    }
  ],
  "generated_at": "${new Date().toISOString()}"
}`

  const userPrompt = `CLIENT: ${project.client_company_name}
Headcount: ${project.headcount ?? 'Unknown'}
Tier: ${project.tier ?? 'Unknown'}

TECH STACK:
${techStackDesc}

DISCOVERY SUMMARY:
${discoverySummaryText}

RECOMMENDED BLUEPRINT SECTIONS:
${recommendedSectionsText}

CLIENT EDITS / FLAGS:
${clientEditsText}

DISCOVERY CHAT TRANSCRIPT (condensed):
${transcript.length > 8000 ? transcript.slice(0, 8000) + '\n[transcript truncated]' : transcript}

Generate a question guide for each of the following sections: ${sectionsForGuide.length ? sectionsForGuide.map((s) => `${s.name} (${s.depth})`).join(', ') : 'Payroll, HRIS, ATS, Benefits, Performance'}.

For "deep" depth sections, include 12-15 questions. For "standard", 8-10 questions. For "light", 5-7 questions.`

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
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[generate-question-guide] Anthropic error:', errText)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
    }

    const aiData = await response.json() as {
      content: Array<{ type: string; text?: string }>
    }

    const rawText = aiData.content.find((c) => c.type === 'text')?.text ?? ''

    // Extract JSON from response
    let guide: QuestionGuide
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      guide = JSON.parse(jsonMatch[0]) as QuestionGuide
    } catch {
      console.error('[generate-question-guide] JSON parse failed:', rawText.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    // Save to project
    await db.update(projects)
      .set({ question_guide: JSON.stringify(guide), updated_at: new Date() })
      .where(eq(projects.id, projectId))

    return NextResponse.json({ guide })
  } catch (err) {
    console.error('[POST /api/ai/generate-question-guide]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import {
  projects,
  projectMembers,
  discoverySessions,
  chatMessages,
  techStackSystems,
  integrations,
  blueprintSections,
} from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

// ── Types ──────────────────────────────────────────────────────────────────

interface SectionSpec {
  key: string
  name: string
  depth: 'light' | 'standard' | 'deep'
  rationale?: string
}

interface AnthropicEvent {
  type: string
  delta?: { type: string; text?: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function paragraphTarget(depth: 'light' | 'standard' | 'deep'): string {
  if (depth === 'light') return '2–3 focused paragraphs'
  if (depth === 'deep') return '6–10 comprehensive paragraphs with specific details, edge cases, and integration points'
  return '4–6 well-developed paragraphs'
}

function buildProjectContext(params: {
  companyName: string
  headcount: number | null
  tier: string | null
  scopeNotes: string | null
  systems: Array<{ system_name: string; vendor: string | null; is_primary: boolean | null; system_type: string | null; modules_used: string | null; notes: string | null }>
  integrationRows: Array<{ sourceSystem: string; targetSystem: string; quality: string }>
}): string {
  const lines: string[] = [`Company: ${params.companyName}`]
  if (params.headcount) lines.push(`Headcount: ${params.headcount.toLocaleString()} employees`)
  if (params.tier) lines.push(`Tier: ${params.tier}`)

  if (params.scopeNotes?.startsWith('{"__v":')) {
    try {
      const profile = JSON.parse(params.scopeNotes) as {
        industry?: string
        hq_state?: string
        countries?: string[]
        employee_types?: string[]
        union_employees?: boolean
        payroll_frequency?: string
        fiscal_year_end?: string
        go_live_date?: string
        budget_approved?: string
      }
      if (profile.industry) lines.push(`Industry: ${profile.industry}`)
      if (profile.hq_state) lines.push(`HQ State: ${profile.hq_state}`)
      if (profile.countries?.length) lines.push(`Countries: ${profile.countries.join(', ')}`)
      if (profile.employee_types?.length) lines.push(`Employee types: ${profile.employee_types.join(', ')}`)
      if (profile.union_employees) lines.push('Has union employees')
      if (profile.payroll_frequency) lines.push(`Payroll frequency: ${profile.payroll_frequency}`)
      if (profile.go_live_date) lines.push(`Target go-live: ${profile.go_live_date}`)
    } catch { /* skip */ }
  }

  if (params.systems.length > 0) {
    lines.push('\nCurrent Tech Stack:')
    for (const s of params.systems) {
      const label = s.is_primary ? ' [PRIMARY]' : ''
      const vendor = s.vendor ? ` (${s.vendor})` : ''
      const type = s.system_type ? ` — ${s.system_type}` : ''
      lines.push(`  • ${s.system_name}${vendor}${type}${label}`)
      if (s.modules_used) {
        try {
          const mods = JSON.parse(s.modules_used) as string[]
          if (mods.length) lines.push(`    Modules: ${mods.join(', ')}`)
        } catch { /* skip */ }
      }
      if (s.notes) lines.push(`    Notes: ${s.notes}`)
    }
  }

  if (params.integrationRows.length > 0) {
    lines.push('\nIntegrations:')
    for (const i of params.integrationRows) {
      lines.push(`  • ${i.sourceSystem} ↔ ${i.targetSystem} (${i.quality.replace(/_/g, ' ')})`)
    }
  }

  return lines.join('\n')
}

function buildDiscoveryContext(params: {
  discoverySummary: string | null
  clientEdits: string | null
  approvedExtractions: Array<{ section: string; content: string; type: string }>
  chatHighlights: string[]
}): string {
  const lines: string[] = []

  if (params.discoverySummary) {
    try {
      const ds = JSON.parse(params.discoverySummary) as {
        overview?: string
        pain_points?: Array<{ description: string; severity?: string }>
        priorities?: Array<{ priority: string }>
        vendors_staying?: Array<{ name: string; reason?: string }>
        vendors_replacing?: Array<{ name: string; reason?: string }>
        complexity_signals?: Array<{ area: string; description: string }>
      }
      if (ds.overview) lines.push(`Discovery Overview: ${ds.overview}`)
      if (ds.pain_points?.length) {
        lines.push('\nPain Points:')
        ds.pain_points.forEach((p) => lines.push(`  • [${p.severity ?? 'medium'}] ${p.description}`))
      }
      if (ds.priorities?.length) {
        lines.push('\nPriorities:')
        ds.priorities.forEach((p, i) => lines.push(`  ${i + 1}. ${p.priority}`))
      }
      if (ds.vendors_staying?.length) {
        lines.push('\nVendors to Keep:')
        ds.vendors_staying.forEach((v) => lines.push(`  • ${v.name}${v.reason ? ` — ${v.reason}` : ''}`))
      }
      if (ds.vendors_replacing?.length) {
        lines.push('\nVendors to Replace:')
        ds.vendors_replacing.forEach((v) => lines.push(`  • ${v.name}${v.reason ? ` — ${v.reason}` : ''}`))
      }
      if (ds.complexity_signals?.length) {
        lines.push('\nComplexity Signals:')
        ds.complexity_signals.forEach((c) => lines.push(`  • ${c.area}: ${c.description}`))
      }
    } catch { /* skip */ }
  }

  if (params.clientEdits) {
    try {
      const ce = JSON.parse(params.clientEdits) as {
        additional_context?: string
        section_flags?: Record<string, string>
      }
      if (ce.additional_context) lines.push(`\nClient Additional Context: ${ce.additional_context}`)
      if (ce.section_flags && Object.keys(ce.section_flags).length) {
        lines.push('\nClient Section Flags (priorities/notes):')
        Object.entries(ce.section_flags).forEach(([key, note]) => lines.push(`  • ${key}: ${note}`))
      }
    } catch { /* skip */ }
  }

  if (params.approvedExtractions.length > 0) {
    lines.push('\nApproved Deep Discovery Extractions:')
    for (const e of params.approvedExtractions) {
      lines.push(`  [${e.type} / ${e.section}] ${e.content}`)
    }
  }

  if (params.chatHighlights.length > 0) {
    lines.push('\nDeep Discovery Chat Highlights:')
    params.chatHighlights.forEach((h) => lines.push(`  • ${h}`))
  }

  return lines.join('\n')
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      stream: false,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${res.status} ${err}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find((c) => c.type === 'text')?.text ?? ''
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const authSession = await verifySessionToken(sessionCookie.value)
  if (!authSession) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  if (authSession.role !== 'advisor' && authSession.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  let body: { project_id: string; section_ids?: string[] }
  try {
    body = await req.json() as { project_id: string; section_ids?: string[] }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const { project_id, section_ids } = body
  if (!project_id) {
    return new Response(JSON.stringify({ error: 'project_id required' }), { status: 400 })
  }

  // Verify access
  const memberCheck = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, project_id))
    .all()
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, project_id))
    .get()

  if (!project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })
  const hasAccess =
    project.created_by === authSession.userId ||
    memberCheck.some(() => true) ||
    authSession.role === 'admin'
  if (!hasAccess) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

  // Load tech stack
  const systems = await db
    .select({
      id: techStackSystems.id,
      system_name: techStackSystems.system_name,
      vendor: techStackSystems.vendor,
      system_type: techStackSystems.system_type,
      is_primary: techStackSystems.is_primary,
      modules_used: techStackSystems.modules_used,
      notes: techStackSystems.notes,
    })
    .from(techStackSystems)
    .where(eq(techStackSystems.project_id, project_id))
    .all()

  const integrationRows = await db
    .select({
      source_id: integrations.source_system_id,
      target_id: integrations.target_system_id,
      quality: integrations.integration_quality,
    })
    .from(integrations)
    .where(eq(integrations.project_id, project_id))
    .all()

  const integrationsMapped = integrationRows.map((i) => ({
    sourceSystem: systems.find((s) => s.id === i.source_id)?.system_name ?? i.source_id,
    targetSystem: systems.find((s) => s.id === i.target_id)?.system_name ?? i.target_id,
    quality: i.quality,
  }))

  // Load all sessions for approved extractions and chat highlights
  const sessions = await db
    .select({
      id: discoverySessions.id,
      session_type: discoverySessions.session_type,
      session_label: discoverySessions.session_label,
      transcript_extractions: discoverySessions.transcript_extractions,
      participant_role: discoverySessions.participant_role,
    })
    .from(discoverySessions)
    .where(eq(discoverySessions.project_id, project_id))
    .all()

  // Collect approved extractions from transcript sessions
  const approvedExtractions: Array<{ section: string; content: string; type: string }> = []
  for (const s of sessions) {
    if (s.session_type === 'transcript' && s.transcript_extractions) {
      try {
        const te = JSON.parse(s.transcript_extractions) as {
          extractions?: Array<{ section: string; content: string; type: string; status: string }>
        }
        if (te.extractions) {
          te.extractions.filter((e) => e.status === 'approved').forEach((e) => {
            approvedExtractions.push({ section: e.section, content: e.content, type: e.type })
          })
        }
      } catch { /* skip */ }
    }
  }

  // Load deep_discovery chat messages for highlights (user messages only, last 20 per session)
  const chatHighlights: string[] = []
  for (const s of sessions) {
    if (s.session_type === 'deep_discovery') {
      const msgs = await db
        .select({ role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(eq(chatMessages.session_id, s.id))
        .orderBy(asc(chatMessages.created_at))
        .all()
      const userMsgs = msgs.filter((m) => m.role === 'user').slice(-20)
      userMsgs.forEach((m) => {
        if (m.content.length > 30) chatHighlights.push(m.content.slice(0, 400))
      })
    }
  }

  // Parse recommended sections to determine what to generate
  let sectionSpecs: SectionSpec[] = []
  if (project.recommended_sections) {
    try {
      const rs = JSON.parse(project.recommended_sections) as Array<{
        key?: string
        section_key?: string
        name?: string
        section_name?: string
        title?: string
        depth?: string
        recommended_depth?: string
        rationale?: string
      }>
      sectionSpecs = rs.map((s) => ({
        key: s.key ?? s.section_key ?? '',
        name: s.name ?? s.section_name ?? s.title ?? s.key ?? '',
        depth: ((s.depth ?? s.recommended_depth ?? 'standard') as SectionSpec['depth']),
        rationale: s.rationale,
      })).filter((s) => s.name)
    } catch { /* skip */ }
  }

  // If no recommended sections, fall back to existing blueprint_sections
  if (sectionSpecs.length === 0) {
    const existing = await db
      .select({ section_key: blueprintSections.section_key, section_name: blueprintSections.section_name, depth: blueprintSections.depth })
      .from(blueprintSections)
      .where(eq(blueprintSections.project_id, project_id))
      .all()
    sectionSpecs = existing.map((s) => ({
      key: s.section_key,
      name: s.section_name,
      depth: s.depth as SectionSpec['depth'],
    }))
  }

  // If section_ids specified, filter to only those
  if (section_ids && section_ids.length > 0) {
    // Load existing sections to map IDs to keys
    const existingSections = await db
      .select({ id: blueprintSections.id, section_key: blueprintSections.section_key })
      .from(blueprintSections)
      .where(eq(blueprintSections.project_id, project_id))
      .all()
    const targetKeys = new Set(
      existingSections.filter((s) => section_ids.includes(s.id)).map((s) => s.section_key)
    )
    sectionSpecs = sectionSpecs.filter((s) => targetKeys.has(s.key))
  }

  if (sectionSpecs.length === 0) {
    return new Response(JSON.stringify({ error: 'No sections to generate' }), { status: 400 })
  }

  // Build context strings
  const projectContext = buildProjectContext({
    companyName: project.client_company_name,
    headcount: project.headcount,
    tier: project.tier,
    scopeNotes: project.scope_notes,
    systems,
    integrationRows: integrationsMapped,
  })

  const discoveryContext = buildDiscoveryContext({
    discoverySummary: project.discovery_summary,
    clientEdits: project.client_edits,
    approvedExtractions,
    chatHighlights,
  })

  // Set up SSE streaming
  const encoder = new TextEncoder()
  // eslint-disable-next-line prefer-const
  let streamController!: ReadableStreamDefaultController<Uint8Array>

  function send(data: object) {
    const line = `data: ${JSON.stringify(data)}\n\n`
    streamController.enqueue(encoder.encode(line))
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
    },
  })

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })

  // Generate sections asynchronously
  ;(async () => {
    try {
      send({ type: 'start', total: sectionSpecs.length })

      const now = new Date()
      let generatedCount = 0

      for (let i = 0; i < sectionSpecs.length; i++) {
        const spec = sectionSpecs[i]!
        send({ type: 'section_start', index: i + 1, total: sectionSpecs.length, section: spec.name })

        const systemPrompt = `You are an expert HCM technology consultant writing a Blueprint for an HR technology implementation project.

Your task: Write the Current State Analysis and Future State Requirements for ONE Blueprint section.

Project Context:
${projectContext}

Discovery & Requirements Data:
${discoveryContext}

Instructions:
- Write in professional consulting prose — clear, specific, and actionable
- Current State: describe what the client has today, their pain points, limitations, and how they use their current technology for this area
- Future State: describe what the ideal future looks like — specific requirements, capabilities needed, integrations, success criteria
- Be specific to THIS company and their data — avoid generic filler
- Length target: ${paragraphTarget(spec.depth)} per section
- Do not use headers within the narrative — write flowing prose paragraphs
- Focus areas from discovery: ${spec.rationale ?? 'general requirements for this functional area'}`

        const userMessage = `Write the Blueprint section for: **${spec.name}**

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "current_state": "...",
  "future_state": "..."
}`

        let currentState = ''
        let futureState = ''

        try {
          const text = await callClaude(systemPrompt, userMessage)
          const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
          const parsed = JSON.parse(clean) as { current_state?: string; future_state?: string }
          currentState = parsed.current_state ?? ''
          futureState = parsed.future_state ?? ''
        } catch (err) {
          console.error(`[generate-blueprint] Failed to generate section ${spec.name}:`, err)
          currentState = 'Generation failed — please regenerate this section.'
          futureState = 'Generation failed — please regenerate this section.'
        }

        // Upsert blueprint section
        const existing = await db
          .select({ id: blueprintSections.id, ai_narrative_current: blueprintSections.ai_narrative_current })
          .from(blueprintSections)
          .where(eq(blueprintSections.project_id, project_id))
          .all()

        const existingSection = existing.find((s) => {
          // Match by key (dynamic or legacy)
          return (s as unknown as { section_key: string }).section_key === spec.key
        })

        // Re-query to get section_key
        const allSections = await db
          .select({ id: blueprintSections.id, section_key: blueprintSections.section_key })
          .from(blueprintSections)
          .where(eq(blueprintSections.project_id, project_id))
          .all()

        const match = allSections.find((s) => s.section_key === spec.key)

        if (match) {
          await db
            .update(blueprintSections)
            .set({
              ai_narrative_current: currentState,
              ai_narrative_future: futureState,
              status: 'draft',
              updated_at: now,
            })
            .where(eq(blueprintSections.id, match.id))
        } else {
          await db.insert(blueprintSections).values({
            id: createId(),
            project_id,
            section_name: spec.name,
            section_key: spec.key,
            depth: spec.depth,
            status: 'draft',
            completeness_score: 0,
            ai_narrative_current: currentState,
            ai_narrative_future: futureState,
          })
        }

        generatedCount++
        send({ type: 'section_done', index: i + 1, total: sectionSpecs.length, section: spec.name })
      }

      // Update project status and generation tracking
      const currentCount = project.generation_count ?? 0
      await db
        .update(projects)
        .set({
          status: 'blueprint_generation',
          generated_at: now,
          generation_count: currentCount + 1,
          generation_metadata: JSON.stringify({
            generated_at: now.toISOString(),
            sections_generated: sectionSpecs.map((s) => s.name),
            session_count: sessions.length,
            approved_extraction_count: approvedExtractions.length,
          }),
          updated_at: now,
        })
        .where(eq(projects.id, project_id))

      send({ type: 'done', generated: generatedCount })
    } catch (err) {
      console.error('[generate-blueprint] Fatal error:', err)
      send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      streamController.close()
    }
  })()

  return response
}

import { NextRequest, NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import {
  projects,
  projectMembers,
  discoverySessions,
  chatMessages,
  techStackSystems,
} from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

// ── Types ──────────────────────────────────────────────────────────────────

interface Extractions {
  pain_points?: Array<{ description: string; severity: string; related_system?: string }>
  priorities?: Array<{ priority: string; rank: number }>
  vendors_staying?: Array<{ name: string; reason?: string }>
  vendors_replacing?: Array<{ name: string; reason?: string }>
  project_params?: {
    go_live_date?: string
    budget_status?: string
    decision_team?: string
    vendor_include?: string[]
    vendor_exclude?: string[]
  }
  complexity_signals?: Array<{ area: string; description: string; severity: string }>
  topics_covered?: string[]
  is_complete?: boolean
}

interface AnthropicEvent {
  type: string
  delta?: { type: string; text?: string }
  message?: { stop_reason?: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildProjectContext(project: {
  client_company_name: string
  headcount: number | null
  tier: string | null
  scope_notes: string | null
}, systems: Array<{ system_name: string; vendor: string | null; is_primary: boolean | null; modules_used: string | null }>): string {
  const lines: string[] = [`Company: ${project.client_company_name}`]
  if (project.headcount) lines.push(`Headcount: ${project.headcount.toLocaleString()} employees`)
  if (project.tier) lines.push(`Tier: ${project.tier}`)

  // Parse company profile for additional context
  if (project.scope_notes?.startsWith('{"__v":')) {
    try {
      const profile = JSON.parse(project.scope_notes) as {
        industry?: string
        hq_city?: string
        hq_state?: string
        has_international?: boolean
        ownership_structure?: string
      }
      if (profile.industry) lines.push(`Industry: ${profile.industry}`)
      if (profile.hq_city && profile.hq_state) lines.push(`Location: ${profile.hq_city}, ${profile.hq_state}`)
      if (profile.has_international) lines.push('Has international employees')
      if (profile.ownership_structure) lines.push(`Ownership: ${profile.ownership_structure}`)
    } catch { /* skip */ }
  }

  // Tech stack context
  const primary = systems.find((s) => s.is_primary)
  if (primary) {
    lines.push(`\nCurrent Primary Platform: ${primary.vendor ?? primary.system_name}`)
    if (primary.modules_used) {
      try {
        const modules = JSON.parse(primary.modules_used) as string[]
        if (modules.length > 0) lines.push(`Modules in use: ${modules.join(', ')}`)
      } catch { /* skip */ }
    }
  }

  const others = systems.filter((s) => !s.is_primary)
  if (others.length > 0) {
    lines.push(`Other systems: ${others.map((s) => s.vendor ?? s.system_name).join(', ')}`)
  }

  return lines.join('\n')
}

function buildDiscoverySystemPrompt(context: string): string {
  return `You are an OutSail Blueprint assistant — a warm, expert HR technology consultant conducting a quick discovery session with a client.

CLIENT CONTEXT:
${context}

YOUR GOAL:
Cover 3 topics in a light, conversational ~5-10 minute session:
1. Pain Points & Focus (what isn't working, what they need most)
2. Vendor Landscape (which systems they want to keep vs. replace, any vendors they're already evaluating)
3. Complexities & Constraints (timeline pressure, budget status, compliance requirements, integration complexity)

GUIDELINES:
- Be warm, professional, and consultative — not clinical or interrogative
- Ask one focused question at a time, never multiple questions
- Show you've read their context (reference their actual vendor names, headcount, etc.)
- Keep your responses concise: 2-4 sentences plus your question
- When you have enough on all 3 topics, naturally wrap up with a brief summary and tell them you'll generate their Blueprint structure

OPENING MESSAGE:
Acknowledge their tech stack by name. Note something specific (e.g., "I can see you're running [Vendor] with [N] other tools"). Then pivot to the first topic in a friendly way.

CRITICAL: Only respond with your conversational message. No JSON, no markdown headers, no lists unless it flows naturally in conversation.`
}

function buildDeepDiscoverySystemPrompt(context: string, focusAreas?: string[]): string {
  const focusSection = focusAreas?.length
    ? `\nFOCUS AREAS FOR THIS SESSION: ${focusAreas.join(', ')}`
    : ''

  return `You are an OutSail Blueprint assistant — an expert HR technology consultant conducting a deep discovery session.

CLIENT CONTEXT:
${context}${focusSection}

YOUR GOAL:
Conduct a thorough requirements discovery session covering:
- Detailed process flows and pain points
- Integration requirements and complexity
- Compliance and regulatory needs
- Reporting and analytics requirements
- User populations and adoption challenges
- Section-specific deep requirements

GUIDELINES:
- Go deep on each topic area before moving on
- Ask clarifying follow-up questions
- When a section feels complete, explicitly summarize what you captured before moving to the next
- Track coverage across all focus areas
- When most sections have been addressed, suggest wrapping up

CRITICAL: Only respond with your conversational message. No JSON, no markdown headers.`
}

async function callAnthropicNonStreaming(params: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  max_tokens?: number
}): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.max_tokens ?? 1024,
      stream: false,
      system: params.system,
      messages: params.messages,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error ${response.status}: ${err}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>
  }
  return data.content[0]?.text ?? ''
}

async function extractStructuredData(
  conversationMessages: Array<{ role: string; content: string }>
): Promise<Extractions> {
  const conversationText = conversationMessages
    .map((m) => `${m.role === 'assistant' ? 'Consultant' : 'Client'}: ${m.content}`)
    .join('\n\n')

  const extractionSystem = `You analyze HR technology discovery conversations and extract structured information. Return ONLY valid JSON matching the exact schema below, with no other text, explanation, or markdown.

JSON schema:
{
  "pain_points": [{"description": "string", "severity": "high|medium|low", "related_system": "string or null"}],
  "priorities": [{"priority": "string", "rank": 1}],
  "vendors_staying": [{"name": "string", "reason": "string or null"}],
  "vendors_replacing": [{"name": "string", "reason": "string or null"}],
  "project_params": {
    "go_live_date": "string or null",
    "budget_status": "not_started|exploring|approved|null",
    "decision_team": "string or null",
    "vendor_include": [],
    "vendor_exclude": []
  },
  "complexity_signals": [{"area": "string", "description": "string", "severity": "high|medium|low"}],
  "topics_covered": [],
  "is_complete": false
}

topics_covered: array containing any of "pain_points", "vendor_landscape", "complexities" — only include a topic when meaningful info was shared.
is_complete: true only when all three topics have been covered sufficiently.
Only include items explicitly mentioned in the conversation.`

  try {
    const text = await callAnthropicNonStreaming({
      system: extractionSystem,
      messages: [
        {
          role: 'user',
          content: `Extract structured information from this discovery conversation:\n\n${conversationText}`,
        },
      ],
      max_tokens: 1500,
    })

    // Parse JSON — find the first { ... } block
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0]) as Extractions
  } catch {
    return {}
  }
}

function buildAnthropicMessages(
  dbMessages: Array<{ role: string; content: string }>,
  userMessage?: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // Anthropic requires messages to start with 'user'
  // If DB has messages starting with assistant (the opening), prepend a trigger
  if (dbMessages.length === 0 || dbMessages[0].role === 'assistant') {
    messages.push({ role: 'user', content: '[Session started. Please begin.]' })
  }

  for (const msg of dbMessages) {
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
  }

  if (userMessage) {
    messages.push({ role: 'user', content: userMessage })
  }

  return messages
}

// ── POST /api/ai/chat ──────────────────────────────────────────────────────

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

  const body = await request.json() as {
    sessionId: string
    projectId: string
    sessionType: 'discovery' | 'deep_discovery'
    message?: string
    focusAreas?: string[]
  }

  const { sessionId, projectId, sessionType, message, focusAreas } = body

  if (!sessionId || !projectId || !sessionType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify project access
  const memberCheck = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, authSession.userId))
    .all()

  const hasAccess = memberCheck.some((m) => m.project_id === projectId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Load project + tech stack for context
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const systems = await db
    .select({
      system_name: techStackSystems.system_name,
      vendor: techStackSystems.vendor,
      is_primary: techStackSystems.is_primary,
      modules_used: techStackSystems.modules_used,
    })
    .from(techStackSystems)
    .where(eq(techStackSystems.project_id, projectId))
    .all()

  // Load existing chat history for this session
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionId))
    .orderBy(asc(chatMessages.created_at))
    .all()

  const context = buildProjectContext(project, systems)
  const systemPrompt =
    sessionType === 'discovery'
      ? buildDiscoverySystemPrompt(context)
      : buildDeepDiscoverySystemPrompt(context, focusAreas)

  const anthropicMessages = buildAnthropicMessages(history, message)

  // Save user message to DB (optimistically, before streaming)
  const userMsgId = createId()
  if (message) {
    await db.insert(chatMessages).values({
      id: userMsgId,
      session_id: sessionId,
      project_id: projectId,
      role: 'user',
      content: message,
    })
  }

  // ── Start Anthropic streaming request ─────────────────────────────────────
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  })

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    console.error('[chat] Anthropic error:', errText)
    return NextResponse.json({ error: 'AI service error' }, { status: 502 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const dataStr = line.slice(6).trim()
            if (!dataStr || dataStr === '[DONE]') continue

            try {
              const event = JSON.parse(dataStr) as AnthropicEvent
              if (
                event.type === 'content_block_delta' &&
                event.delta?.type === 'text_delta' &&
                event.delta.text
              ) {
                fullText += event.delta.text
                send({ type: 'delta', text: event.delta.text })
              }
            } catch { /* skip invalid JSON */ }
          }
        }

        // ── Post-stream: save assistant message + run extraction ──────────
        const assistantMsgId = createId()
        const now = new Date()

        // Extract structured data from full conversation
        const allMessages = message
          ? [...history, { role: 'user', content: message }, { role: 'assistant', content: fullText }]
          : [...history, { role: 'assistant', content: fullText }]

        let extractions: Extractions = {}
        if (allMessages.length > 1) {
          extractions = await extractStructuredData(allMessages)
        }

        // Save assistant message with extractions
        await db.insert(chatMessages).values({
          id: assistantMsgId,
          session_id: sessionId,
          project_id: projectId,
          role: 'assistant',
          content: fullText,
          extractions: Object.keys(extractions).length > 0 ? JSON.stringify(extractions) : null,
          created_at: now,
        })

        // Send extractions to client
        if (Object.keys(extractions).length > 0) {
          send({ type: 'extractions', data: extractions })
        }

        // Check if discovery session is complete
        if (extractions.is_complete && sessionType === 'discovery') {
          // Mark session as completed
          await db
            .update(discoverySessions)
            .set({ status: 'completed', updated_at: new Date() })
            .where(eq(discoverySessions.id, sessionId))

          send({ type: 'session_complete' })
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[chat stream] Error:', err)
        send({ type: 'error', message: 'Stream processing error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

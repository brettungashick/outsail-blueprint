import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/lib/db'
import {
  projects,
  projectMembers,
  blueprintSections,
  requirements,
  decisions,
  openQuestions,
  techStackSystems,
  integrations,
  generatedOutputs,
} from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

type OutputType =
  | 'project_summary'
  | 'tech_stack_viz'
  | 'discovery_summary'
  | 'meeting_agenda'
  | 'scorecard_settings'
  | 'implementation_blueprint'

interface OutputConfig {
  vendor_name?: string
  duration_minutes?: number
  attendees?: string
  focus_areas?: string[]
}

interface AnthropicEvent {
  type: string
  delta?: { type: string; text?: string }
}

function send(controller: ReadableStreamDefaultController<Uint8Array>, data: object) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
}

async function streamClaude(
  prompt: string,
  systemPrompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic error ${response.status}: ${err}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        const event = JSON.parse(raw) as AnthropicEvent
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          fullText += event.delta.text
          onChunk(event.delta.text)
        }
      } catch { /* skip malformed */ }
    }
  }

  return fullText
}

function buildProjectSummaryPrompt(data: ProjectData): string {
  return `You are an expert HCM consultant writing a concise executive summary for ${data.companyName}.

PROJECT CONTEXT:
${data.contextBlock}

BLUEPRINT SECTIONS (${data.sections.length} sections):
${data.sections.map(s => `## ${s.section_name}\n**Current State:**\n${s.ai_narrative_current || 'Not yet drafted'}\n\n**Future Requirements:**\n${s.ai_narrative_future || 'Not yet drafted'}`).join('\n\n---\n\n')}

Write a 1-2 page executive project summary in professional markdown. Structure:
1. **Executive Summary** (3-4 sentences overview)
2. **Organization Profile** (company, headcount, industry, key characteristics)
3. **Current Technology Landscape** (systems in use, key pain points)
4. **Future State Vision** (what success looks like after implementation)
5. **Key Requirements** (top 5-8 prioritized requirements across all modules)
6. **Critical Decisions Made** (if any)
7. **Next Steps** (recommended immediate actions)

Be specific, data-driven, and professional. This document will be shared with HR technology vendors.`
}

function buildDiscoverySummaryPrompt(data: ProjectData): string {
  const reqsBySection = data.sections.map(s => {
    const reqs = data.requirements.filter(r => r.section_id === s.id)
    return { section: s, reqs }
  }).filter(x => x.reqs.length > 0 || x.section.ai_narrative_current)

  return `You are an expert HCM consultant writing a vendor-facing requirements document for ${data.companyName}.

PROJECT CONTEXT:
${data.contextBlock}

BLUEPRINT DATA:
${reqsBySection.map(({ section, reqs }) => `
### ${section.section_name}
**Narrative:** ${section.ai_narrative_current || ''}
**Future State:** ${section.ai_narrative_future || ''}
**Requirements (${reqs.length}):**
${reqs.map(r => `- [${r.criticality || 'standard'}] ${r.future_requirement}${r.business_impact ? ` | Impact: ${r.business_impact}` : ''}`).join('\n')}`).join('\n\n')}

Write a comprehensive vendor-facing requirements document in professional markdown. Structure:

# Discovery Summary: ${data.companyName} HR Technology Requirements

## Company Overview
(Organization profile, headcount, industry, key characteristics)

## Workforce Profile
(Employee types, locations, union status, payroll details)

## Current Systems & Technology
(Existing tech stack, integration landscape, key pain points)

## Requirements by Module
(For each module/section: overview paragraph, then bulleted requirements organized by criticality)

## Integration Requirements
(Key integrations needed, data flows, technical requirements)

## Constraints & Considerations
(Timeline, budget signals, compliance requirements, geography)

## Timeline & Implementation Preferences
(Go-live targets, phasing preferences, change management needs)

## Questions for Vendor
(5-10 open questions the vendor should address in their demo/proposal)

Be specific and professional. This document will be sent to HR technology vendors during the evaluation process.`
}

function buildMeetingAgendaPrompt(data: ProjectData, config: OutputConfig): string {
  const vendorName = config.vendor_name || 'Vendor'
  const duration = config.duration_minutes || 60
  const attendees = config.attendees || 'HR leadership, IT stakeholders'
  const focusAreas = config.focus_areas?.join(', ') || 'all modules'

  return `You are an expert HCM consultant preparing a vendor demo agenda for ${data.companyName}.

PROJECT CONTEXT:
${data.contextBlock}

MEETING DETAILS:
- Vendor: ${vendorName}
- Duration: ${duration} minutes
- Attendees: ${attendees}
- Focus Areas: ${focusAreas}

KEY REQUIREMENTS TO VALIDATE:
${data.requirements
  .filter(r => r.criticality === 'must_have' || r.criticality === 'should_have')
  .slice(0, 20)
  .map(r => `- ${r.future_requirement}`)
  .join('\n')}

Write a professional time-boxed meeting agenda in markdown. Structure:

# ${vendorName} Demo Agenda
**${data.companyName} | ${duration}-Minute Session**

## Pre-Meeting Preparation
(What to send the vendor in advance, what to prepare)

## Agenda

| Time | Topic | Owner | Notes |
|------|-------|-------|-------|
(Create a detailed time-boxed agenda fitting ${duration} minutes)

## Key Questions to Ask
(10-15 specific, targeted questions for this vendor based on requirements)

## Evaluation Criteria
(5-7 criteria to assess during the demo)

## Show Me Scenarios
(3-5 specific "show me how you'd handle..." scenarios based on their requirements)

## Next Steps Template
(What to do immediately after the meeting)

Make the agenda specific to their requirements and the vendor. Be practical and actionable.`
}

function buildScorecardPrompt(data: ProjectData): string {
  return `You are an expert HCM consultant creating a vendor evaluation scorecard for ${data.companyName}.

PROJECT CONTEXT:
${data.contextBlock}

REQUIREMENTS SUMMARY:
${data.sections.map(s => `- ${s.section_name}: ${data.requirements.filter(r => r.section_id === s.id).length} requirements`).join('\n')}

TOP MUST-HAVE REQUIREMENTS:
${data.requirements
  .filter(r => r.criticality === 'must_have')
  .slice(0, 15)
  .map(r => `- [${r.module}] ${r.future_requirement}`)
  .join('\n')}

Create a comprehensive vendor evaluation scorecard in JSON format. The scorecard should have:
- 6-10 evaluation categories (based on the actual modules/requirements)
- Each category should have 6-10 specific evaluation questions
- Each question should be scoreable 1-5 with clear scoring guidance
- Weight categories by importance based on must-have requirements

Return ONLY valid JSON in this exact structure:
{
  "title": "HR Technology Vendor Evaluation Scorecard",
  "company": "${data.companyName}",
  "generated_at": "${new Date().toISOString()}",
  "instructions": "Rate each criterion 1-5. Weight scores by category weight.",
  "categories": [
    {
      "id": "unique_id",
      "name": "Category Name",
      "weight": 0.20,
      "description": "What this category covers",
      "criteria": [
        {
          "id": "criterion_id",
          "question": "Evaluation question",
          "guidance": "What to look for / scoring guidance",
          "score": null,
          "notes": ""
        }
      ]
    }
  ],
  "scoring_guide": {
    "5": "Exceeds requirements — best-in-class capability",
    "4": "Meets requirements with minor gaps",
    "3": "Partially meets requirements — significant gaps",
    "2": "Mostly does not meet requirements",
    "1": "Does not meet requirements at all"
  }
}`
}

function buildImplementationBlueprintPrompt(data: ProjectData): string {
  return `You are an expert HCM consultant writing a comprehensive implementation blueprint for ${data.companyName}.

PROJECT CONTEXT:
${data.contextBlock}

BLUEPRINT SECTIONS:
${data.sections.map(s => `
## ${s.section_name}
**Current State:** ${s.ai_narrative_current || 'N/A'}
**Future State:** ${s.ai_narrative_future || 'N/A'}
**Requirements (${data.requirements.filter(r => r.section_id === s.id).length}):**
${data.requirements.filter(r => r.section_id === s.id).slice(0, 10).map(r => `- [${r.criticality || 'standard'}] ${r.future_requirement}`).join('\n')}`).join('\n\n---\n\n')}

DECISIONS MADE:
${data.decisions.map(d => `- ${d.decision_text}${d.rationale ? ` (Rationale: ${d.rationale})` : ''}`).join('\n') || 'None documented'}

OPEN QUESTIONS:
${data.openQuestions.filter(q => q.status === 'open').map(q => `- [${q.status}] ${q.question_text}`).join('\n') || 'None outstanding'}

Write a comprehensive implementation blueprint document in professional markdown. This is a Reed Smith-style document covering everything needed for successful implementation.

Structure:

# Implementation Blueprint: ${data.companyName}
## HR Technology Transformation Program

### Executive Summary
(Brief overview of the transformation initiative)

### Table of Contents
(Auto-generated TOC)

### 1. Current State Assessment
(For each system: what exists, pain points, what's working)

### 2. Future State Architecture
(Recommended system architecture, vendor selection criteria, integration design)

### 3. Requirements by Module
(For each module: detailed requirements organized by priority, with acceptance criteria)

### 4. Integration Specifications
(Each integration: source, target, data flows, frequency, error handling)

### 5. Process Transformation Maps
(Current → Future state for key processes)

### 6. Implementation Roadmap
(Phased approach, milestones, dependencies)

### 7. Change Management Plan
(Stakeholder map, communication plan, training needs)

### 8. Decision Log
(All key decisions made during discovery)

### 9. Open Issues & Next Steps
(Outstanding questions, owner, timeline)

### 10. Appendix
(Detailed requirements tables, integration diagrams)

Be comprehensive, specific, and professional. This is the primary deliverable of the OutSail engagement.`
}

interface ProjectData {
  companyName: string
  contextBlock: string
  sections: Array<{
    id: string
    section_name: string
    section_key: string
    ai_narrative_current: string | null
    ai_narrative_future: string | null
  }>
  requirements: Array<{
    id: string
    section_id: string
    module: string
    future_requirement: string
    criticality: string | null
    business_impact: string | null
  }>
  decisions: Array<{ decision_text: string; rationale: string | null }>
  openQuestions: Array<{ question_text: string; status: string }>
  systems: Array<{ system_name: string; vendor: string | null; is_primary: boolean | null; system_type: string | null }>
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return new Response('Unauthorized', { status: 401 })

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return new Response('Unauthorized', { status: 401 })
  if (session.role !== 'advisor' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const body = await req.json() as { project_id: string; output_type: OutputType; config?: OutputConfig }
  const { project_id, output_type, config = {} } = body

  if (!project_id || !output_type) {
    return new Response('Missing project_id or output_type', { status: 400 })
  }

  // Verify membership
  const membership = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, project_id))
    .get()
  if (!membership) return new Response('Not found', { status: 404 })

  // Load project
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, project_id))
    .get()
  if (!project) return new Response('Not found', { status: 404 })

  // Load all data
  const [sections, reqs, allDecisions, allQuestions, systems, allIntegrations] = await Promise.all([
    db.select({ id: blueprintSections.id, section_name: blueprintSections.section_name, section_key: blueprintSections.section_key, ai_narrative_current: blueprintSections.ai_narrative_current, ai_narrative_future: blueprintSections.ai_narrative_future }).from(blueprintSections).where(eq(blueprintSections.project_id, project_id)).all(),
    db.select({ id: requirements.id, section_id: requirements.section_id, module: requirements.module, future_requirement: requirements.future_requirement, criticality: requirements.criticality, business_impact: requirements.business_impact }).from(requirements).where(eq(requirements.project_id, project_id)).all(),
    db.select({ decision_text: decisions.decision_text, rationale: decisions.rationale }).from(decisions).where(eq(decisions.project_id, project_id)).all(),
    db.select({ question_text: openQuestions.question_text, status: openQuestions.status }).from(openQuestions).where(eq(openQuestions.project_id, project_id)).all(),
    db.select({ id: techStackSystems.id, system_name: techStackSystems.system_name, vendor: techStackSystems.vendor, is_primary: techStackSystems.is_primary, system_type: techStackSystems.system_type, modules_used: techStackSystems.modules_used, notes: techStackSystems.notes }).from(techStackSystems).where(eq(techStackSystems.project_id, project_id)).all(),
    db.select({ source_system_id: integrations.source_system_id, target_system_id: integrations.target_system_id, integration_quality: integrations.integration_quality }).from(integrations).where(eq(integrations.project_id, project_id)).all(),
  ])

  // Build context block
  const contextLines: string[] = [
    `Company: ${project.client_company_name}`,
    `Headcount: ${project.headcount ?? 'Not specified'}`,
    `Tier: ${project.tier ?? 'Not specified'}`,
    `Status: ${project.status}`,
  ]

  if (project.scope_notes?.startsWith('{"__v":')) {
    try {
      const profile = JSON.parse(project.scope_notes) as Record<string, unknown>
      if (profile.industry) contextLines.push(`Industry: ${profile.industry}`)
      if (profile.hq_state) contextLines.push(`HQ State: ${profile.hq_state}`)
      if (Array.isArray(profile.countries) && profile.countries.length) contextLines.push(`Countries: ${(profile.countries as string[]).join(', ')}`)
      if (Array.isArray(profile.employee_types) && profile.employee_types.length) contextLines.push(`Employee types: ${(profile.employee_types as string[]).join(', ')}`)
      if (profile.go_live_date) contextLines.push(`Target go-live: ${profile.go_live_date}`)
    } catch { /* skip */ }
  }

  if (systems.length > 0) {
    const primary = systems.filter(s => s.is_primary).map(s => s.system_name)
    const others = systems.filter(s => !s.is_primary).map(s => s.system_name)
    if (primary.length) contextLines.push(`Primary system(s): ${primary.join(', ')}`)
    if (others.length) contextLines.push(`Other systems: ${others.join(', ')}`)
  }

  if (allIntegrations.length > 0) {
    contextLines.push(`Integrations: ${allIntegrations.length} configured`)
  }

  const projectData: ProjectData = {
    companyName: project.client_company_name,
    contextBlock: contextLines.join('\n'),
    sections,
    requirements: reqs,
    decisions: allDecisions,
    openQuestions: allQuestions,
    systems,
  }

  // Determine if this is JSON output (scorecard)
  const isJsonOutput = output_type === 'scorecard_settings'

  let streamController!: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(controller) { streamController = controller },
  })

  ;(async () => {
    try {
      send(streamController, { type: 'start', output_type })
      send(streamController, { type: 'progress', message: 'Loading project data...' })

      // Build the right prompt
      let prompt: string
      let systemPrompt: string

      switch (output_type) {
        case 'project_summary':
          prompt = buildProjectSummaryPrompt(projectData)
          systemPrompt = 'You are an expert HCM consultant writing professional documents. Use clean markdown formatting.'
          break
        case 'discovery_summary':
          prompt = buildDiscoverySummaryPrompt(projectData)
          systemPrompt = 'You are an expert HCM consultant writing vendor-facing requirements documents. Be specific and professional.'
          break
        case 'meeting_agenda':
          prompt = buildMeetingAgendaPrompt(projectData, config)
          systemPrompt = 'You are an expert HCM consultant preparing structured meeting agendas. Be practical and time-specific.'
          break
        case 'scorecard_settings':
          prompt = buildScorecardPrompt(projectData)
          systemPrompt = 'You are an expert HCM consultant building evaluation scorecards. Return ONLY valid JSON, no other text.'
          break
        case 'implementation_blueprint':
          prompt = buildImplementationBlueprintPrompt(projectData)
          systemPrompt = 'You are an expert HCM consultant writing comprehensive implementation blueprints. Be thorough and professional.'
          break
        default:
          throw new Error(`Unknown output type: ${output_type}`)
      }

      send(streamController, { type: 'progress', message: 'Generating content with AI...' })

      let fullContent = ''
      const fullText = await streamClaude(prompt, systemPrompt, (chunk) => {
        fullContent += chunk
        send(streamController, { type: 'chunk', text: chunk })
      })

      if (!fullText) fullContent = fullText

      // Validate JSON for scorecard
      if (isJsonOutput) {
        try {
          JSON.parse(fullContent)
        } catch {
          const jsonMatch = fullContent.match(/\{[\s\S]+\}/)
          if (jsonMatch) fullContent = jsonMatch[0]
        }
      }

      send(streamController, { type: 'progress', message: 'Saving output...' })

      // Check for existing output of this type
      const existing = await db
        .select({ id: generatedOutputs.id, version: generatedOutputs.version })
        .from(generatedOutputs)
        .where(eq(generatedOutputs.project_id, project_id))
        .all()
      const match = existing.find(o => {
        // We need to check output_type - but we can't filter in .all() easily without casting
        // Use a fresh query
        return false
      })
      void match

      const existingOfType = await db
        .select({ id: generatedOutputs.id, version: generatedOutputs.version })
        .from(generatedOutputs)
        .all()
      const existingRow = existingOfType.find(r => {
        // We'll do a separate targeted query below
        return false
      })
      void existingRow

      // Query specifically for this project + type
      const allOutputs = await db
        .select({ id: generatedOutputs.id, version: generatedOutputs.version, output_type: generatedOutputs.output_type })
        .from(generatedOutputs)
        .where(eq(generatedOutputs.project_id, project_id))
        .all()

      const existingOutput = allOutputs.find(o => o.output_type === output_type)

      let outputId: string

      if (existingOutput) {
        // Update existing
        await db
          .update(generatedOutputs)
          .set({
            content: fullContent,
            status: 'ready',
            version: (existingOutput.version ?? 1) + 1,
            format: isJsonOutput ? 'json' : 'docx',
          })
          .where(eq(generatedOutputs.id, existingOutput.id))
        outputId = existingOutput.id
      } else {
        // Create new
        outputId = createId()
        await db.insert(generatedOutputs).values({
          id: outputId,
          project_id,
          output_type,
          status: 'ready',
          content: fullContent,
          format: isJsonOutput ? 'json' : 'docx',
          version: 1,
          generated_by: session.userId,
        })
      }

      send(streamController, { type: 'done', output_id: outputId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      send(streamController, { type: 'error', message: msg })
    } finally {
      streamController.close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

**OUTSAIL**

**BLUEPRINT**

Technical Product Specification

Complete Platform Design, Architecture & Build Guide

Version 4.0 \| March 2026

Next.js · Turso · Vercel · Claude API

**CONFIDENTIAL**

**Resolved Design Decisions**

Branding: OutSail-branded, admin-uploadable logo \| Auth: Magic link \| Pricing: Free (included in service)

Self-service: LLM-guided chat as consultant \| Exports: PDF/DOCX \| Transcripts: Paste + chat both supported

Table of Contents

1\. Vision

OutSail Blueprint is a standalone, OutSail-branded web application that transforms how OutSail captures, structures, and activates client requirements across the HR technology evaluation lifecycle. It is provided free to clients as part of OutSail's existing advisory service.

Blueprint replaces the current Typeform survey and manually-authored Word documents with a single intelligent workspace. Clients can self-serve through an AI-guided conversational experience that feels like talking to an expert HCM consultant, while advisors retain full control to enrich, refine, and activate the Blueprint.

+---------------------+--------------------------------------------------------------------------------------------------------------------------+
| **Core Principles** | 1\. Self-service first: Clients can build a substantial Blueprint without an advisor call, guided by an LLM consultant.  |
|                     |                                                                                                                          |
|                     | 2\. Advisor superpowers: Advisors review, enrich, and activate --- they don't do data entry.                             |
|                     |                                                                                                                          |
|                     | 3\. Flexible depth: Every client gets a baseline. Depth is additive per module, not tier-gated.                          |
|                     |                                                                                                                          |
|                     | 4\. Activate, don't archive: The Blueprint generates outputs that eliminate vendor discovery calls and accelerate demos. |
+---------------------+--------------------------------------------------------------------------------------------------------------------------+

2\. Resolved Design Decisions

The following decisions are final and should not be revisited during implementation:

  -------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Decision**               **Resolution**

  Branding                   OutSail-branded. Admin can upload logo. Client workspaces show OutSail branding.

  Auth                       Magic link email (passwordless). No SSO for v1. Session: 30-day httpOnly cookie.

  Pricing                    Free. Blueprint is included in OutSail's existing advisory service. No paywall.

  Self-service model         LLM-guided chat interface. The client talks to a "Blueprint Assistant" that conducts discovery like a consultant. No advisor call required, though advisors can still do external calls and paste transcripts.

  Transcript ingestion       Paste-only (v1). No meeting recorder API integration. Both paths coexist: self-service chat AND advisor-pasted transcripts.

  Export formats             Blueprint, Discovery Summary, Agendas, Impl Blueprint: PDF + DOCX. Tech Stack Visualization: PDF only (visual with arrows/circles). Scorecard Settings: text/JSON only (configures scorecards in the main OutSail app).

  Templates                  Not for v1. No industry-specific Blueprint templates yet.

  Existing app integration   Not for v1. No data flow between Blueprint and main OutSail app yet.

  Tech stack                 Next.js 14 (App Router), Turso (libSQL) via Drizzle ORM, Vercel, Tailwind + shadcn/ui, Resend for email, Claude API (Sonnet 4).
  -------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

3\. Design System & Brand Consistency

Blueprint must feel like a natural extension of the existing OutSail application. The design system below is derived from the current OutSail app UI.

3.1 Visual Identity

-   **Light foundation:** White/near-white backgrounds (#FFFFFF, #F8F7F4). No dark mode for v1.

-   **Rounded geometry:** Circles are a signature element (tech stack visualization). Cards: 12--16px radius. Buttons: 8px radius or pill for primary CTAs.

-   **Subtle depth:** Very light box shadows (0 1px 3px rgba(0,0,0,0.08)) on cards. Light gray borders (#D3D1C7) or whitespace separation.

-   **Typography:** Inter as web font. Body: 14px/400. Labels: 13px/500. Headers: 18--24px/600. Colors: primary #3D3D3A, secondary #6B6B65, tertiary #9C9C95.

-   **Icons:** Lucide React. Outlined, 20--24px. Functional only, never decorative.

-   **Left sidebar:** Fixed, \~80px collapsed / 240px expanded. Icon + label stacked vertically. Avatar at top with dropdown.

Color Palette

  ---------------- ---------- ----------------------------------------------------------
  **Name**         **Hex**    **Usage**

  Teal (Primary)   #1D9E75    Primary buttons, active nav, progress, links, success

  Teal Dark        #0F6E56    Hover states, header accents

  Teal Light       #E1F5EE    Selected states, success badges, tinted backgrounds

  Navy             #1B3A5C    Page titles, section headers, high-emphasis text

  Coral            #D85A30    Warnings, "No Systems" badges, attention-required states

  Amber            #E5A000    In-progress, "mostly automated" integration, caution

  Purple           #5B4FC7    Wizard "Next" buttons, point solution labels

  Blue             #3B6FC2    Info badges, integration lines, secondary actions

  Red              #D93025    Errors, destructive actions, "fully manual" indicator

  Green            #1D8348    Completion, "fully integrated", approved sections

  Slate            #3D3D3A    Primary text color

  Gray 200         #D3D1C7    Borders, dividers

  Gray 50          #F8F7F4    Page background, alternating rows
  ---------------- ---------- ----------------------------------------------------------

Integration Quality Indicators (preserved from OutSail app)

-   **Fully Integrated:** Green circle (#1D8348), solid line

-   **Mostly Automated:** Amber circle (#E5A000), dashed line

-   **Partially Automated:** Coral circle (#D85A30), dotted line

-   **Fully Manual:** Red circle (#D93025), dashed red line

3.2 Key Component Patterns

-   Sidebar nav: icon + label, active state with teal highlight, avatar at top

-   Cards: white bg, 12--16px radius, 24px padding, subtle shadow or 1px border

-   Wizards: horizontal step bar, checkmarks on completed, teal/green for done, purple for current, gray for future

-   Primary button: teal bg, white text, 8px radius. Secondary: white bg, teal border

-   Star ratings: amber filled, gray outlined. Three columns: Admin / Employee / Service

-   Tech stack viz: hub-and-spoke circles, primary vendor center (280--320px), point solutions orbiting (160--200px), gap indicators with coral "NO SYSTEMS"

3.3 Admin-Uploadable Logo

OutSail admin can upload the company logo via a settings page. The logo appears in the sidebar header, on generated PDF/DOCX exports, and on client-facing invitation emails. Default: OutSail text mark in teal.

4\. Blueprint Assistant: Self-Service Chat

This is the defining feature of Blueprint. Instead of requiring an advisor call for discovery, the client can have an intelligent, multi-turn conversation with a "Blueprint Assistant" that conducts discovery like an expert HCM consultant. The chat is persistent, context-aware, and structures every response back into the Blueprint in real-time.

4.1 How It Works

Entry Point

After the client completes the structured intake modules (Phase 2), the app presents the Blueprint Assistant chat. The opening message acknowledges what the client has already entered and immediately begins probing for depth:

*"Thanks for mapping out your tech stack and priorities. I can see you're running Gusto for payroll and HRIS with integrations to Ashby and Okta. Before we go further, I'd love to understand a few things about how your team actually uses Gusto day-to-day. For example --- when someone new joins Credit Genie, what does that onboarding process look like from an HR systems perspective? Walk me through it like you're explaining it to a new team member."*

Conversation Design

The Blueprint Assistant follows these principles:

-   **Domain-by-domain:** The chat works through Blueprint sections sequentially, but follows the client's natural conversational flow. If they mention payroll complexity while discussing onboarding, the Assistant follows that thread.

-   **Probe, don't interrogate:** Questions feel conversational, not like a questionnaire. "You mentioned spreadsheets for comp --- who owns that process and how long does a typical cycle take?" not "What is your compensation process frequency?"

-   **Reflect and confirm:** After gathering information on a topic, the Assistant summarizes what it understood and asks the client to confirm. "So if I'm understanding correctly, your benefits enrollment is mostly self-service through Gusto, but partner benefits are handled via a separate spreadsheet that Sarah manages. Is that right?"

-   **Surface gaps and recommendations:** The Assistant proactively identifies gaps and suggests best practices. "I notice you don't have a dedicated performance management tool. Many companies your size are starting to formalize reviews around the 100--150 headcount mark. Is that something you'd want the next system to support?"

-   **Respect the client's depth appetite:** If a client gives brief answers, the Assistant doesn't push relentlessly. It notes the area as "light" depth and moves on. If a client goes deep, it follows and enriches.

-   **Know when to stop:** When the Assistant has sufficient coverage across all relevant sections, it summarizes and suggests the client review their Blueprint. It does not loop indefinitely.

Real-Time Blueprint Population

Every substantive client response is processed in the background:

-   Client message is sent to Claude along with the current Blueprint context

-   Claude returns both a conversational reply AND structured data extractions (requirements, processes, decisions, questions)

-   Extracted data is written to the database immediately and the Blueprint sections update in real-time

-   The client can switch to the Blueprint view at any time and see their requirements populating as they chat

-   A sidebar indicator shows which Blueprint sections have been covered and their current completeness

4.2 System Prompt Architecture

The Blueprint Assistant uses a carefully designed system prompt with these components:

Identity & Tone

You are a senior HCM Solution Consultant working for OutSail, a technology advisory firm. You are conducting a discovery conversation with a client to understand their current HR technology landscape, processes, pain points, and requirements for their next system. You are warm, knowledgeable, and efficient. You speak like an experienced consultant, not like a chatbot.

Context Injection

Every message includes the current state of the Blueprint as context:

-   Company profile (name, headcount, locations, ownership)

-   Current tech stack (primary vendor, point solutions, integration quality)

-   Intake responses (pain points, priorities, must-haves/nice-to-haves)

-   Requirements already captured (with completeness per section)

-   Open questions still unresolved

-   Conversation history (last 20 messages for continuity)

Behavioral Rules

-   Ask 1--2 questions per message, not more. Let the client respond naturally.

-   After 3--4 exchanges on a topic, summarize what you've learned and confirm.

-   When you have enough on a section, explicitly transition: "That gives me a clear picture of your payroll needs. Let's talk about how you handle benefits."

-   Track which sections have been covered and at what depth. Prioritize uncovered sections.

-   If the client seems done or disengaged, offer to wrap up and summarize.

-   Never make up requirements. If you're unsure, ask.

-   Flag areas where the client's needs may be more complex than they realize.

Structured Output

Each Claude response returns JSON with two fields:

{

\"reply\": \"The conversational message shown to the client\",

\"extractions\": {

\"requirements\": \[{ module, sub_process, current_state, future_req, criticality, \... }\],

\"processes\": \[{ process_name, trigger, actors, steps, \... }\],

\"decisions\": \[{ decision_text, rationale, \... }\],

\"questions\": \[{ question_text, section, \... }\],

\"tech_stack_updates\": \[{ system_name, field, new_value }\],

\"section_depth_signals\": \[{ section, suggested_depth, reason }\]

}

}

The reply is streamed to the client in real-time. The extractions are processed asynchronously and written to the database. The client sees only the conversational reply --- the structured data populates silently in the background.

4.3 Chat UX Design

-   **Placement:** Full-width main content area (not a sidebar chat widget). The chat is the primary experience, not a secondary feature.

-   **Message style:** Clean chat bubbles. Assistant messages on the left (with OutSail avatar), client messages on the right. Streaming response with typing indicator.

-   **Blueprint sidebar:** A collapsible right panel showing real-time Blueprint section completeness. As the chat progresses, sections fill in. Client can click any section to see what's been captured so far.

-   **Quick actions:** Below the chat input, contextual quick-action chips like "Tell me about your payroll process" or "I'd like to skip this section" that the client can tap instead of typing.

-   **Session persistence:** The chat persists across sessions. Client can close the browser and come back days later; the Assistant picks up where it left off.

-   **Handoff to advisor:** At any point, the client can request to involve their advisor. The advisor sees the full chat history and can continue the conversation or switch to processing transcripts from external calls.

4.4 Advisor Interaction with Chat

Advisors have full visibility into the client's chat:

-   Advisors can read the complete chat history for any project

-   Advisors can see the structured extractions alongside each message (what was captured)

-   Advisors can edit or discard any extraction before it's finalized in the Blueprint

-   Advisors can "join" the chat --- messages from the advisor appear with a different avatar/color and are clearly distinguished from the AI Assistant

-   Advisors can add their own context to the system prompt (e.g., "This client has a unique equity partner comp structure --- make sure to probe on that")

4.5 Chat + Transcript Coexistence

Both paths feed the same Blueprint. A typical Enterprise engagement might look like:

-   Client completes structured intake (Phase 2)

-   Client has 2--3 chat sessions with the Blueprint Assistant over a few days (self-service depth)

-   Advisor reviews what the chat captured, identifies gaps, adds notes

-   Advisor conducts an external town hall call with multiple stakeholders

-   Advisor pastes the transcript into Blueprint for AI processing

-   Extracted data from the transcript merges with existing chat-sourced data, with conflicts flagged

-   Advisor resolves conflicts, enriches attributes, and moves sections to "Complete"

5\. Technical Architecture

5.1 Stack

  ---------------- -------------------------------- ---------------------------------------------------------------
  **Layer**        **Technology**                   **Notes**

  Framework        Next.js 14+ (App Router)         Server components, API routes, Vercel-native

  Database         Turso (libSQL)                   Already provisioned, SQLite-at-edge

  ORM              Drizzle                          Type-safe, Turso-native, schema-as-code

  Hosting          Vercel                           Already set up

  Auth             Custom magic link                JWT token in link, Resend for delivery, 30-day session cookie

  AI               Claude API (Sonnet 4)            4 workloads: chat, transcript, drafting, outputs

  Styling          Tailwind CSS                     Custom theme matching OutSail brand

  Components       shadcn/ui + Lucide               Headless, Tailwind-native

  Email            Resend + React Email             Magic links, notifications

  Exports          docx-js, pdfkit, html-to-image   DOCX/PDF generation, tech stack PNG
  ---------------- -------------------------------- ---------------------------------------------------------------

5.2 Claude API Workloads

Four distinct workloads, each with its own system prompt and output format:

  -------------------------- --------------------------------- --------------------------------------- ------------------------------------
  **Workload**               **Trigger**                       **Input**                               **Output**

  Blueprint Assistant Chat   Client sends a message            Message + Blueprint context + history   Streaming reply + JSON extractions

  Transcript Processing      Advisor pastes transcript         Raw transcript + Blueprint context      Structured JSON extractions

  Blueprint Drafting         Advisor clicks "Generate Draft"   Section data + depth setting            Streaming prose narratives

  Output Generation          Advisor configures + generates    Full Blueprint + output params          Formatted document content
  -------------------------- --------------------------------- --------------------------------------- ------------------------------------

Chat Workload: Dual-Output Architecture

The chat workload is unique because it produces two outputs simultaneously: a conversational reply (streamed to the client) and structured data extractions (processed in the background). Implementation approach:

-   Claude is instructed to return JSON with \"reply\" and \"extractions\" fields

-   The API route parses the response and streams the reply to the client in real-time

-   Once the full response is received, the extractions are validated and written to the database

-   The client-side Blueprint sidebar polls for updates or uses a WebSocket/SSE connection to reflect new data

-   If extraction fails or returns low-confidence results, data is queued for advisor review rather than auto-committed

Context Window Management

For the chat workload, context window management is critical:

-   System prompt: \~2,000 tokens (identity, rules, output format)

-   Blueprint context: \~3,000--8,000 tokens depending on complexity (summarized, not raw)

-   Conversation history: last 20 messages, \~2,000--5,000 tokens

-   Current message: \~100--500 tokens

-   Total: \~7,000--16,000 tokens input, leaving ample room for output within Sonnet 4's context window

-   For very large Blueprints (Enterprise), compress the context by sending only the relevant section's full data and summaries of other sections

5.3 Database Schema

Core entities (see v3 spec for full field definitions). Key addition for v4:

New: Chat Messages Table

chat_messages

id, project_id, role (assistant\|client\|advisor\|system),

content (text), // The visible message

extractions (JSON, nullable), // Structured data extracted from this exchange

extraction_status (none\|pending\|committed\|rejected),

created_by (user_id), created_at

New: Chat Context Table

chat_contexts

id, project_id,

advisor_notes (text, nullable), // Advisor-injected context for the system prompt

sections_covered (JSON), // Which sections the chat has addressed

current_topic (text, nullable), // What the chat is currently exploring

suggested_next_topics (JSON), // AI-suggested next areas to probe

updated_at

All other tables remain as defined in v3: organizations, projects, users, project_members, tech_stack_systems, integrations, blueprint_sections, requirements, processes, decisions, open_questions, sessions, generated_outputs.

6\. Client Journey

6.1 Phase 1: Project Setup (Advisor, \~5 min)

-   Advisor creates project: company name, primary contact email, headcount, scope notes

-   System auto-suggests tier (Essentials/Growth/Enterprise); advisor adjusts

-   Default section depths set per tier; advisor can override per module

-   Client receives branded magic link invitation email with OutSail logo

6.2 Phase 2: Structured Intake (Client, 15--30 min)

Five adaptive modules replace Typeform:

-   **Module 1 --- Company Profile:** Firmographics, headcount, locations, workforce composition, ownership

-   **Module 2 --- Tech Stack Builder:** Visual hub-and-spoke builder. Set primary vendor, confirm modules, rate experience, add point solutions, map integrations

-   **Module 3 --- Pain Points:** Card-sort exercise (15--20 cards, three buckets) + top 3 deep-dive + priority ranking

-   **Module 4 --- Project Parameters:** Timeline, budget, decision team, vendor lists, implementation interest

-   **Module 5 --- Requirements:** Capability checklist, Must Have vs. Nice to Have

6.3 Phase 3: Blueprint Assistant Chat (Client, self-paced)

After intake, the client enters the Blueprint Assistant. This is the primary depth-building experience:

-   Chat opens with a personalized greeting referencing intake data

-   Assistant conducts conversational discovery, domain by domain

-   Requirements, processes, and decisions are extracted in real-time and populate the Blueprint

-   Client can see Blueprint sections filling in via a sidebar panel

-   Client can chat across multiple sessions over days/weeks

-   Client can request advisor involvement at any time

6.4 Phase 3b: Transcript Processing (Advisor, optional)

For engagements that also include live advisor sessions:

-   Advisor pastes transcript from external call into the project

-   AI extracts structured data and presents for advisor review

-   Approved extractions merge into the Blueprint alongside chat-sourced data

-   Conflicts between chat-sourced and transcript-sourced data are flagged

6.5 Phase 4: Blueprint Assembly & Review

-   Advisor reviews all captured data (from chat + transcripts + intake)

-   Advisor generates Current/Future State narratives via AI

-   Advisor enriches requirement attributes (criticality, compliance, etc.)

-   Advisor resolves open questions, logs decisions

-   Client reviews and approves section-by-section

6.6 Phase 5: Output Generation

Gated by readiness level:

-   **Draft Ready:** Project Summary (PDF/DOCX), Tech Stack Visualization (PDF)

-   **Demo Ready:** Discovery Summary (PDF/DOCX), Meeting Agendas (PDF/DOCX), Scorecard Settings (text for main app)

-   **Implementation Ready:** Implementation Blueprint (PDF/DOCX)

7\. Requirement Ontology, Process Format & Completeness

Detailed in v3 spec (Sections 3--5). Summary:

-   **Requirement Record:** 12-field ontology: module, sub-process, actors, trigger, current state, future requirement, exceptions, integration dependencies, reporting needs, approval rules, geography/entity, source

-   **Enriched Attributes:** 7 fields: criticality (MoSCoW), business impact, frequency, user population, compliance/regulatory, implementation complexity, differentiator vs. table stakes

-   **Process Format:** 14-field standardized schema. Required fields scale by module depth (Light: 5, Standard: 10, Deep: all 14)

-   **Completeness:** 5 section-level states (Not Started → Client Approved). Calculated against depth setting. Sections cannot be "Complete" with Open/Conflicting questions.

-   **Readiness Gates:** Draft Ready → Demo Ready → Implementation Ready. Control which outputs can be generated.

-   **Decision Log:** Structured records: decision, date, maker(s), rationale, linked section, source, impact

-   **Open Questions:** 6-status lifecycle: Open → Pending Client → Pending Advisor → Conflicting → Resolved → Deferred

8\. User Roles & Permissions

  ------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------
  **Role**      **Can Do**                                                                                                                                                  **Cannot Do**

  Admin         Everything globally. Upload logo. Manage users. View analytics. System config.                                                                              N/A

  Advisor       CRUD projects. Invite clients. Paste transcripts. Generate/edit AI content. Join chat. Add advisor notes to chat context. Manage decisions and questions.   See other advisors' projects. Change system settings.

  Client        Complete intake. Chat with Blueprint Assistant. View/comment/edit Blueprint. Approve sections. Generate outputs (if enabled). Invite team members.          See other orgs. Paste transcripts. See raw AI extractions. See advisor-only notes.

  Vendor (v2)   View shared outputs. Submit clarifying questions (queued for client approval).                                                                              See Blueprint, other vendors, scorecard, chat history, or un-shared content.
  ------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------

9\. Output Generation Details

9.1 Project Summary

**Gate:** Draft Ready. **Format:** PDF + DOCX. **Length:** 1--2 pages.

Executive business case document. AI drafts from Executive Summary + top pain points.

9.2 Tech Stack Visualization

**Gate:** Draft Ready. **Format:** PDF only (visual with circles, arrows, color-coded lines).

Hub-and-spoke view + integration flow map. In-app: interactive and editable. Export: polished static render.

9.3 Discovery Summary

**Gate:** Demo Ready. **Format:** PDF + DOCX. **Length:** 5--15 pages.

Vendor-facing requirements document structured in the format HCM vendors expect from their own discovery. Includes company profile, system landscape, requirements by module with enriched attributes, constraints, and prep questions for the vendor. Eliminates 1--2 vendor discovery calls.

9.4 Meeting Agendas

**Gate:** Demo Ready. **Format:** PDF + DOCX.

Advisor configures: vendor, attendees (with roles/interests), duration, focus domains. AI generates time-boxed agenda with "show me" prompts, attendee mapping, and challenge scenarios.

9.5 Scorecard Settings

**Gate:** Demo Ready. **Format:** Text/JSON only (used to configure scorecards in main OutSail app).

6--10 criteria, \~8 evaluation questions each. Specific to client's Blueprint data, not generic. Output is structured data that feeds into the existing OutSail scoring system.

9.6 Implementation Blueprint

**Gate:** Implementation Ready. **Format:** PDF + DOCX. **Length:** 10--30+ pages.

Full restructuring for implementation audience: current-to-future state by module, integration specs, process maps, decision log, data migration notes, configuration preferences, stakeholder map. This is the Reed Smith-style document.

10\. Security & Privacy

-   **Auth:** Magic link. 15-minute token expiry. 30-day httpOnly secure session cookie. MFA not required for v1.

-   **Authorization:** Row-level security via organization_id + project_members. Every query scoped.

-   **Encryption:** TLS 1.3 in transit (Vercel). AES-256 at rest (Turso).

-   **No PII:** Blueprint captures organizational/systems data only, not employee-level data.

-   **Transcripts:** Stored in sessions table. Advisors can delete after processing.

-   **Chat history:** Stored in chat_messages table. Visible to client and advisor only.

-   **Audit log:** All actions logged: view, edit, export, share, chat message, AI generation.

-   **Claude API:** Server-side only. API key in environment variable, never exposed to client.

11\. Phased Build Plan

Phase 1: Foundation (Weeks 1--6)

**Goal:** Replace Typeform. Advisor creates projects, clients complete intake, tech stack visualized.

-   Next.js + Turso + Drizzle + Tailwind + shadcn/ui setup

-   Magic link auth via Resend

-   Core schema: orgs, projects, users, project_members, tech_stack_systems, integrations

-   Advisor dashboard: project list, new project, quick-toggle

-   Client workspace: invitation flow, progress tracker

-   All 5 intake modules with adaptive questions

-   Interactive tech stack builder with hub-and-spoke visualization

-   Admin settings: logo upload

-   Role-based access control

Phase 2: Intelligence + Chat (Weeks 7--14)

**Goal:** Blueprint Assistant chat + transcript processing + Blueprint assembly.

-   Blueprint Assistant chat interface (full-width, persistent, streaming)

-   Claude API integration: chat workload with dual output (reply + extractions)

-   Real-time Blueprint population from chat

-   Chat context management (history, Blueprint state, advisor notes)

-   Transcript paste + AI processing workload

-   Blueprint section CRUD with per-module depth

-   Requirement ontology: structured records with core + enriched fields

-   Process capture format with standard schema

-   Open questions management + decision log

-   Section-level completeness scoring

-   Client review/approval workflow with comments

-   AI-assisted narrative generation (Current/Future State)

Phase 3: Outputs (Weeks 15--20)

**Goal:** Generate all six output types.

-   Output generation engine with output-specific Claude prompts

-   Project Summary (PDF + DOCX)

-   Tech Stack Visualization (PDF export from in-app render)

-   Discovery Summary (PDF + DOCX)

-   Meeting Agendas (PDF + DOCX)

-   Scorecard Settings (text/JSON export for main OutSail app)

-   Implementation Blueprint (PDF + DOCX, Reed Smith format)

-   Readiness gating: Draft Ready / Demo Ready / Implementation Ready

-   Output versioning and sharing controls

Phase 4: Scale (Weeks 21--26)

**Goal:** Multi-user collaboration, vendor access, operational tools.

-   Vendor user role with gated access + question queue

-   Multi-stakeholder intake (different users, different sections)

-   Email notifications (section ready, question assigned, chat activity)

-   Admin analytics dashboard

-   Advisor-to-advisor project handoff

-   Performance optimization for large Blueprints

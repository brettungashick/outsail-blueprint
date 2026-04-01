# OutSail Blueprint — Project Instructions for Claude Code

## What is this project?
OutSail Blueprint is a standalone web application for capturing, structuring, and activating HR technology requirements. It replaces Typeform surveys and manual Word docs with an AI-powered workspace. The full product specification is in `/docs/SPEC.md`.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Database**: Turso (libSQL) via Drizzle ORM
- **Hosting**: Vercel
- **Auth**: Custom magic link (Resend for email delivery)
- **AI**: Claude API (Sonnet 4) — server-side only, key in env var
- **Styling**: Tailwind CSS with custom OutSail brand theme
- **Components**: shadcn/ui + Lucide React icons
- **Email**: Resend + React Email templates
- **Exports**: docx-js (Word), pdfkit (PDF), html-to-image (PNG)

## Key Architecture Decisions
- All Claude API calls are server-side (Next.js API routes). Never expose API key to client.
- Three AI workloads: Chat Sessions (discovery + deep discovery), Transcript Processing, Blueprint Drafting + Output Generation.
- Magic link auth: JWT token with 15-min expiry → httpOnly session cookie (30 days).
- Row-level security: every DB query scoped by project_members.
- Blueprint generation is MANUAL — advisor clicks "Generate Blueprint." Never automatic.
- Advisor always sees Blueprint before client — never publish directly to client.
- Email-only notifications at 3 trigger points (no in-app system until Phase 4).

### Chat Architecture
There is ONE chat component used across all sessions. The AI persona is always the same: an expert HCM consultant — friendly, knowledgeable, doesn't feel like interrogation.

Sessions differ only by **scope and depth**, controlled by the system prompt injected at session start:

| Session Type | Prompt Scope | Time | Endpoint |
|---|---|---|---|
| `discovery` | Light — pain points, vendor landscape, complexity signals | ~5–10 min | Phase A, Module 3 |
| `deep_discovery` | Thorough — processes, exceptions, integrations, compliance | Open-ended | Phase C, Pathway 2 |

Both types feed the **same Blueprint knowledge set** (same project, same extractions DB). The only structural differences:
- `discovery` sessions have a natural endpoint (AI wraps up after covering pain points + vendor landscape + complexity signals)
- `deep_discovery` sessions show a completeness indicator in the sidebar tracking which Blueprint sections have been covered

Stakeholder sessions (Phase C) are just `deep_discovery` sessions with `participant_role` set — same component, same AI, scoped focus areas.

**Transcript processing** (Phase C, Pathway 1) is a separate batch workload — not a chat session.

### Session Completeness Tracking (deep_discovery only)
- AI tracks which Blueprint sections have been covered and at what depth
- After covering a section thoroughly, AI transitions naturally: "I have a good picture of your payroll setup. Want to move on to benefits?"
- When most sections addressed, AI proactively suggests wrapping up
- Sidebar shows completeness indicator per section
- Client can always stop early ("I'm done for now")
- If client stops early, system notes which sections are under-covered so advisor knows what to probe

## Brand Design System
**Colors** (must match existing OutSail app):
- Teal Primary: #1D9E75 (buttons, active states, success)
- Teal Dark: #0F6E56 (hover states)
- Teal Light: #E1F5EE (selected states, tinted backgrounds)
- Navy: #1B3A5C (page titles, headers)
- Coral: #D85A30 (warnings, "No Systems" badges)
- Amber: #E5A000 (in-progress states)
- Purple: #5B4FC7 (wizard "Next" buttons)
- Blue: #3B6FC2 (info badges, secondary actions)
- Slate: #3D3D3A (primary text)
- Gray 600: #6B6B65 (secondary text)
- Gray 200: #D3D1C7 (borders)
- Gray 50: #F8F7F4 (page background)

**Typography**: Inter font. Body 14px/400, labels 13px/500, headers 18-24px/600.
**Layout**: Left sidebar (80px collapsed/240px expanded), max content 1200px, 12-16px border radius on cards, 24px card padding.
**Icons**: Lucide React, outlined, 20-24px.

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, magic-link verify
│   ├── (dashboard)/        # Advisor dashboard
│   ├── (workspace)/        # Client workspace + chat
│   ├── api/
│   │   ├── ai/             # Claude API endpoints
│   │   ├── auth/           # Magic link send/verify
│   │   ├── blueprints/     # Blueprint CRUD
│   │   ├── outputs/        # Output generation
│   │   └── projects/       # Project management
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── blueprint/          # Blueprint section components
│   ├── chat/               # Chat session component (shared across discovery + deep_discovery)
│   ├── intake/             # Intake flow modules
│   ├── tech-stack/         # Hub-and-spoke visualization
│   └── outputs/            # Output viewers/editors
├── lib/
│   ├── db/                 # Drizzle schema + queries
│   ├── ai/                 # Claude API client + prompts
│   ├── auth/               # Auth helpers
│   └── email/              # Email templates
└── types/                  # TypeScript types
```

## Database (Turso + Drizzle)
Core tables: organizations, projects, users, project_members, tech_stack_systems, integrations, blueprint_sections, requirements, processes, decisions, open_questions, sessions, chat_messages, generated_outputs.

Full schema is defined in `src/lib/db/schema.ts`.

### Project Status Enum
Projects move through these statuses in order:

| Status | Meaning |
|---|---|
| `intake` | Client completing Modules 1–3 (Company Profile, Tech Stack, Discovery Chat) |
| `discovery_complete` | Client finished the Quick Discovery Chat |
| `summary_approved` | Client reviewed and approved the discovery summary |
| `deep_discovery` | Advisor conducting requirements calls OR self-service chat is active |
| `blueprint_generation` | Advisor generating Blueprint, reviewing, enriching |
| `client_review` | Blueprint sent to client for section-by-section review |
| `approved` | Client approved all Blueprint sections |
| `outputs` | Outputs being generated or available |

Default on project creation: `intake`.

### Project Record — Phase B Fields
Stored as JSON columns on the `projects` table:
- `discovery_summary` — "What We Heard" (pain points, vendors, complexity signals)
- `recommended_sections` — AI-suggested Blueprint sections with depth indicators
- `client_edits` — client corrections, section flags, and "anything else" free text
- `summary_approved_at` — timestamp when client approved
- `generated_at` — timestamp of last Blueprint generation
- `generation_count` — how many times Blueprint has been generated
- `generation_metadata` — JSON: which sessions/transcripts were included
- `self_service_enabled` — boolean: advisor activates Pathway 2 per project

### Session Data Model
All chat sessions share one table. Session type determines prompt scope:
- `session_type: 'discovery'` — Phase A quick chat (~5–10 min)
- `session_type: 'deep_discovery'` — Phase C self-service or stakeholder session
- `session_type: 'transcript'` — Phase C advisor-uploaded transcript (batch processed)

Sessions table fields include: `participant_name`, `participant_role`, `participant_email`, `focus_areas` (JSON), `status` (active | completed), `created_by`.

All extractions from all sessions feed the same Blueprint.

### Blueprint Sections — Important Note
The `section_key` column in `blueprint_sections` is currently a fixed enum for early development. When Blueprint generation is built (Phase D), this will be migrated to free-text — Blueprint sections are DYNAMIC, determined by AI after discovery. Do not build UI that assumes a fixed set of sections.

### Environment Variable Naming
Vercel's Turso integration auto-injects credentials with a `blueprint_` prefix:
- `blueprint_TURSO_DATABASE_URL`
- `blueprint_TURSO_AUTH_TOKEN`

All code checks the prefixed name first, then falls back to the unprefixed name:
```ts
process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
```
For local development, set the unprefixed versions in `.env.local`.

## Build Phases
**Phase 1** (Foundation — IN PROGRESS): Auth, advisor dashboard, client intake (Modules 1–2 built, Module 3 next), tech stack viz, role-based access.
**Phase 2** (Discovery + Chat): Quick discovery chat, summary review, deep discovery (transcripts + self-service), Blueprint generation, client review.
**Phase 3** (Outputs): All 6 output types with readiness gating and PDF/DOCX export.
**Phase 4** (Polish): In-app notifications, bell icon, activity feed, vendor access, multi-stakeholder UI improvements, analytics.

## Product Flow

### Phase A: Client Intake (Self-Service)
1. Module 1: Company Profile form (built)
2. Module 2: Tech Stack Canvas (built)
3. Module 3: Quick Discovery Chat — 5–10 min AI conversation covering pain points, vendor landscape, complexities (NOT deep requirements gathering). Uses `session_type: 'discovery'`.

### Phase B: Summary Review (Client)
- System generates `discovery_summary` ("What We Heard") + `recommended_sections` (Blueprint structure proposal)
- Client can: correct factual errors, add context via free-text "Anything else?" field, flag section priorities
- Client CANNOT: restructure sections, set depth levels, make architectural decisions
- Client edits stored in `client_edits` JSON — they are INPUTS to the advisor, not AI constraints
- Once client approves → `summary_approved_at` set, status → `summary_approved`, advisor receives email notification

### Phase C: Deep Discovery (Advisor-Controlled)
Advisor sees client edits + section flags and chooses a pathway:

**Pathway 1 (DEFAULT — Transcript Upload):**
- System generates editable question guide from discovery data
- Advisor conducts external call(s), uploads transcript(s)
- Each transcript processed separately, all extractions feed same Blueprint
- Can repeat for multiple sessions
- When ready: advisor manually clicks "Generate Blueprint"
- Can regenerate after uploading additional transcripts

**Pathway 2 (HIDDEN — Self-Service Chat, advisor-activated per project):**
- Advisor sets `self_service_enabled = true` on project
- Client (and optionally invited stakeholders) chat with AI consultant
- Uses `session_type: 'deep_discovery'` with `focus_areas` and `participant_role` set for stakeholders
- AI tracks section coverage, shows completeness indicator in sidebar
- Client clicks "I'm done — ready for my advisor to review" → session marked complete, advisor notified
- Advisor can send client back: "We need more detail on payroll" → reopens chat with a pre-loaded note
- When ready: advisor manually clicks "Generate Blueprint"

### Phase D: Blueprint Generation (Advisor-First)
- Advisor clicks "Generate Blueprint" (manual trigger, any time)
- System processes all sessions + transcripts + tech stack + company profile
- Blueprint goes to ADVISOR FIRST — never directly visible to client
- Advisor reviews, enriches, polishes each section
- If regenerating after manual edits: warn "You have manual edits that will be overwritten. Continue?" with option to regenerate only un-edited sections
- Track: `generated_at`, `generation_count`, `generation_metadata` (which sources included)

### Phase E: Client Blueprint Review
- Advisor sends Blueprint to client → status → `client_review`, client receives email
- Client reviews and approves section by section
- When all sections approved → status → `approved`, advisor receives email notification

### Phase F: Outputs
- Available after Blueprint approval
- Advisor generates outputs (PDF/DOCX export)
- 6 output types: Project Summary, Tech Stack Viz, Discovery Summary, Meeting Agendas, Scorecard Settings, Implementation Blueprint

## Email Notifications
Three fire-and-forget emails using Resend (same setup as magic links):

1. **Client approves summary (Phase B → C):** Email to advisor — "[Company Name] completed their intake and approved the discovery summary. Review it here: [link to project]"
2. **Advisor sends Blueprint for review (Phase D → E):** Email to client — "Your Blueprint is ready for review. [link to workspace/blueprint]"
3. **Client approves Blueprint (Phase E → F):** Email to advisor — "[Company Name] approved their Blueprint. Generate outputs: [link to project]"

Use React Email templates matching OutSail brand. No notifications table. In-app notifications added in Phase 4.

## Key Rules
- Blueprint sections are DYNAMIC — determined by AI after discovery, not a fixed list
- Self-service chat is HIDDEN by default — advisor activates per project (`self_service_enabled`)
- Advisor can invite stakeholders to scoped deep_discovery sessions
- Multiple sessions per project — each processed separately, all feed same Blueprint
- Advisor always sees Blueprint before client — never publish directly
- Blueprint generation is always MANUAL — advisor clicks "Generate Blueprint"
- Project status flow: `intake` → `discovery_complete` → `summary_approved` → `deep_discovery` → `blueprint_generation` → `client_review` → `approved` → `outputs`

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
- Four AI workloads: Blueprint Assistant Chat, Transcript Processing, Blueprint Drafting, Output Generation.
- The chat workload returns dual output: streaming reply (shown to client) + JSON extractions (written to DB).
- Magic link auth: JWT token with 15-min expiry → httpOnly session cookie (30 days).
- Row-level security: every DB query scoped by organization_id + project_members.

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
│   ├── chat/               # Blueprint Assistant chat
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
Core tables: organizations, projects, users, project_members, tech_stack_systems, integrations, blueprint_sections, requirements, processes, decisions, open_questions, sessions, chat_messages, chat_contexts, generated_outputs.

Full schema is defined in `/docs/SPEC.md` Section 5.3.

### Environment Variable Naming
Vercel's Turso integration auto-injects credentials with a `blueprint_` prefix (matching the Vercel project name):
- `blueprint_TURSO_DATABASE_URL`
- `blueprint_TURSO_AUTH_TOKEN`

All code that reads these vars checks the prefixed name first, then falls back to the unprefixed name:
```ts
process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
```
For local development, set the unprefixed versions in `.env.local`. See `.env.example` for the full list.

## Build Phases
**Phase 1** (Foundation): Auth, advisor dashboard, client intake (5 modules), tech stack viz, role-based access.
**Phase 2** (Intelligence + Chat): Blueprint Assistant chat, transcript processing, Blueprint assembly, completeness scoring.
**Phase 3** (Outputs): All 6 output types with readiness gating and PDF/DOCX export.
**Phase 4** (Scale): Vendor access, multi-stakeholder, analytics.

## Product Flow

### Phase A: Client Intake (Self-Service)
1. Module 1: Company Profile form (built)
2. Module 2: Tech Stack Canvas (built)
3. Module 3: Quick Discovery Chat — 5 min AI conversation covering pain points, vendor landscape, complexities (NOT deep requirements gathering)

### Phase B: Summary Review (Client)
- System generates a discovery summary (what was captured) + recommended Blueprint structure (which sections, what depth)
- Client reviews, edits, approves
- Once approved → advisor is notified

### Phase C: Deep Discovery (Advisor-Controlled)
Advisor chooses one of two pathways:
- **Pathway 1 (DEFAULT):** Advisor-led requirements call. System generates an editable question guide. Advisor conducts external call(s), uploads transcript(s). Multiple sessions per project, each processed separately, all feed the same Blueprint.
- **Pathway 2 (HIDDEN, advisor-activated):** Self-service AI consultant made available to client. Advisor can also invite specific stakeholders to their own scoped chat sessions. Multiple stakeholders giving input is supported.

### Phase D: Blueprint Generation (Advisor-First)
- System generates Blueprint from all collected data
- Blueprint goes to ADVISOR FIRST — never directly to client
- Advisor reviews, enriches, polishes, then sends to client

### Phase E: Client Blueprint Review
- Client reviews, comments, approves section by section

### Phase F: Outputs
- Available after Blueprint approval
- 6 output types: Project Summary, Tech Stack Viz, Discovery Summary, Meeting Agendas, Scorecard Settings, Implementation Blueprint

## Key Rules
- Blueprint sections are DYNAMIC — determined by AI after discovery, not a fixed list
- Self-service chat is HIDDEN by default — advisor activates per project
- Advisor can invite stakeholders to their own scoped chat sessions
- Multiple transcript sessions per project — each processed separately
- Advisor always sees Blueprint before client
- Project status flow: Intake → Discovery Complete → Summary Approved → Deep Discovery → Blueprint in Progress → Client Review → Approved → Outputs

## Important Rules
- Always read `/docs/SPEC.md` for detailed requirements before implementing a feature.
- Use the OutSail brand colors exactly as specified — do not substitute.
- The Blueprint Assistant chat is the defining feature. It must feel like talking to an expert consultant, not a chatbot.
- Every requirement in the Blueprint is a structured record (12-field ontology), not free-form prose.
- Process maps follow a standardized 14-field format.
- Section-level completeness scoring gates output generation.
- Export formats: PDF+DOCX for documents, PDF only for tech stack viz, JSON for scorecard settings.
- This is a free service (no paywall). OutSail-branded with admin-uploadable logo.

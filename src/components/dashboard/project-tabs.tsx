'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Clock, Users } from 'lucide-react'
import type { SectionKey, SectionDepth, SectionStatus, ProjectTier, ProjectStatus } from '@/types'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface BlueprintSectionData {
  id: string
  section_key: SectionKey
  section_name: string
  depth: SectionDepth
  status: SectionStatus
  completeness_score: number | null
}

interface ProjectTabsProps {
  project: {
    id: string
    name: string
    client_company_name: string
    client_contact_email: string
    headcount: number | null
    tier: ProjectTier | null
    status: ProjectStatus
    scope_notes: string | null
    readiness_level: string | null
    created_at: Date | null
    updated_at: Date | null
  }
  blueprintSections: BlueprintSectionData[]
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tech-stack', label: 'Tech Stack' },
  { key: 'blueprint', label: 'Blueprint' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'outputs', label: 'Outputs' },
] as const

type TabKey = (typeof TABS)[number]['key']

const STATUS_LABELS: Record<ProjectStatus, string> = {
  setup: 'Setup',
  intake: 'Intake',
  chat: 'Discovery',
  review: 'Review',
  complete: 'Complete',
}

const TIER_LABELS: Record<ProjectTier, string> = {
  essentials: 'Essentials',
  growth: 'Growth',
  enterprise: 'Enterprise',
}

const STATUS_ORDER: ProjectStatus[] = ['setup', 'intake', 'chat', 'review', 'complete']

const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  advisor_review: 'Advisor Review',
  client_approved: 'Client Approved',
  complete: 'Complete',
}

const DEPTH_LABELS: Record<SectionDepth, string> = {
  light: 'Light',
  standard: 'Standard',
  deep: 'Deep',
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatRelativeDate(date: Date | null | undefined): string {
  if (!date) return '—'
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatAbsoluteDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

function SectionStatusDot({ status }: { status: SectionStatus }) {
  const colorMap: Record<SectionStatus, string> = {
    not_started: 'bg-outsail-gray-200',
    in_progress: 'bg-outsail-amber',
    advisor_review: 'bg-outsail-purple',
    client_approved: 'bg-outsail-teal',
    complete: 'bg-outsail-green',
  }
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorMap[status]}`}
      title={SECTION_STATUS_LABELS[status]}
    />
  )
}

// ----------------------------------------------------------------
// Overview Tab
// ----------------------------------------------------------------
function OverviewTab({ project, blueprintSections }: ProjectTabsProps) {
  const overallCompleteness =
    blueprintSections.length > 0
      ? Math.round(
          blueprintSections.reduce(
            (sum, s) => sum + (s.completeness_score ?? 0),
            0
          ) / blueprintSections.length
        )
      : 0

  const readinessLabels: Record<string, string> = {
    draft_ready: 'Draft Ready',
    demo_ready: 'Demo Ready',
    implementation_ready: 'Implementation Ready',
  }

  return (
    <div className="space-y-6">
      {/* Top row: Company Profile + Project Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Company Profile — 60% */}
        <div className="lg:col-span-3 outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">Company Profile</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Company Name</p>
              <p className="text-body text-outsail-slate">{project.client_company_name}</p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Contact Email</p>
              <p className="text-body text-outsail-slate break-all">
                {project.client_contact_email}
              </p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Headcount</p>
              <p className="text-body text-outsail-slate">
                {project.headcount ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-outsail-gray-600" />
                    {project.headcount.toLocaleString()} employees
                  </span>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-0.5">Tier</p>
              <p className="text-body text-outsail-slate">
                {project.tier ? TIER_LABELS[project.tier] : '—'}
              </p>
            </div>
            {project.scope_notes && (
              <div className="col-span-2">
                <p className="text-label text-outsail-gray-600 mb-0.5">Scope Notes</p>
                <p className="text-body text-outsail-slate whitespace-pre-wrap">
                  {project.scope_notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Project Status — 40% */}
        <div className="lg:col-span-2 outsail-card">
          <h3 className="text-header-sm text-outsail-navy mb-4">Project Status</h3>

          {/* Status pipeline */}
          <div className="mb-4">
            <p className="text-label text-outsail-gray-600 mb-2">Pipeline Stage</p>
            <div className="flex items-center gap-1">
              {STATUS_ORDER.map((s, i) => {
                const currentIdx = STATUS_ORDER.indexOf(project.status)
                const isCurrent = s === project.status
                const isPast = i < currentIdx

                return (
                  <React.Fragment key={s}>
                    <div
                      className={`flex-1 py-1.5 px-2 rounded text-center text-xs font-medium transition-colors ${
                        isCurrent
                          ? 'bg-outsail-teal text-white'
                          : isPast
                          ? 'bg-outsail-teal-light text-outsail-teal-dark'
                          : 'bg-outsail-gray-50 text-outsail-gray-600 border border-outsail-gray-200'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </div>
                    {i < STATUS_ORDER.length - 1 && (
                      <div
                        className={`w-2 h-0.5 flex-shrink-0 ${
                          i < currentIdx ? 'bg-outsail-teal' : 'bg-outsail-gray-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Readiness */}
          <div className="mb-4">
            <p className="text-label text-outsail-gray-600 mb-1.5">Readiness Level</p>
            {project.readiness_level ? (
              <Badge variant="complete">{readinessLabels[project.readiness_level] ?? project.readiness_level}</Badge>
            ) : (
              <span className="text-xs text-outsail-gray-600 italic">Not yet assessed</span>
            )}
          </div>

          {/* Dates */}
          <div className="space-y-2 border-t border-outsail-gray-200 pt-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-label text-outsail-gray-600">Created</p>
              <p className="text-xs text-outsail-slate">{formatAbsoluteDate(project.created_at)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-label text-outsail-gray-600">Last Updated</p>
              <p className="text-xs text-outsail-slate flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeDate(project.updated_at ?? project.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Blueprint Sections grid */}
      <div className="outsail-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-header-sm text-outsail-navy">Blueprint Sections</h3>
          <span className="text-sm font-medium text-outsail-gray-600">
            {overallCompleteness}% Complete
          </span>
        </div>

        {blueprintSections.length === 0 ? (
          <p className="text-body text-outsail-gray-600 py-4 text-center">
            No blueprint sections found for this project.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {blueprintSections.map((section) => (
              <div
                key={section.id}
                className="rounded-card border border-outsail-gray-200 p-4 hover:border-outsail-teal/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-outsail-navy leading-tight">
                    {section.section_name}
                  </p>
                  <SectionStatusDot status={section.status} />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${
                      section.depth === 'light'
                        ? 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'
                        : section.depth === 'standard'
                        ? 'bg-blue-50 text-outsail-blue border-blue-200'
                        : 'bg-outsail-navy/5 text-outsail-navy border-outsail-navy/20'
                    }`}
                  >
                    {DEPTH_LABELS[section.depth]}
                  </span>
                  <span className="text-xs text-outsail-gray-600">
                    {section.completeness_score ?? 0}%
                  </span>
                </div>

                <p className="text-xs text-outsail-gray-600 mb-3">
                  {SECTION_STATUS_LABELS[section.status]}
                </p>

                <Link
                  href={`/dashboard/projects/${section.id}/sections/${section.section_key}`}
                  className="text-xs font-medium text-outsail-teal hover:text-outsail-teal-dark transition-colors"
                >
                  Open →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Placeholder Tab
// ----------------------------------------------------------------
function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="py-16 text-center text-outsail-gray-600">
      <p className="text-sm">{label} will be available in Phase 2.</p>
    </div>
  )
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------
export function ProjectTabs({ project, blueprintSections }: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-outsail-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-outsail-teal text-outsail-teal'
                    : 'border-transparent text-outsail-gray-600 hover:text-outsail-navy hover:border-outsail-gray-200'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab project={project} blueprintSections={blueprintSections} />
      )}
      {activeTab === 'tech-stack' && <PlaceholderTab label="Tech Stack" />}
      {activeTab === 'blueprint' && <PlaceholderTab label="Blueprint" />}
      {activeTab === 'sessions' && <PlaceholderTab label="Sessions" />}
      {activeTab === 'outputs' && <PlaceholderTab label="Outputs" />}
    </div>
  )
}

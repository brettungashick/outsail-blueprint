'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Search, FolderKanban, Plus, Clock, Users, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface Project {
  id: string
  name: string
  client_company_name: string
  client_contact_email: string
  headcount: number | null
  tier: string | null
  status: string | null
  readiness_level: string | null
  scope_notes: string | null
  created_at: Date | null
  updated_at: Date | null
}

interface DashboardProjectListProps {
  initialProjects: Project[]
}

const STATUS_LABELS: Record<string, string> = {
  setup: 'Setup',
  intake: 'Intake',
  chat: 'Discovery',
  review: 'Review',
  complete: 'Complete',
}

const TIER_LABELS: Record<string, string> = {
  essentials: 'Essentials',
  growth: 'Growth',
  enterprise: 'Enterprise',
}

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  setup: 'setup',
  intake: 'intake',
  chat: 'chat',
  review: 'review',
  complete: 'complete',
}

const TIER_BADGE_VARIANTS: Record<string, string> = {
  essentials: 'essentials',
  growth: 'growth',
  enterprise: 'enterprise',
}

function formatRelativeDate(date: Date | null | undefined): string {
  if (!date) return '—'
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMinutes === 0) return 'just now'
      return `${diffMinutes}m ago`
    }
    return `${diffHours}h ago`
  }
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export function DashboardProjectList({ initialProjects }: DashboardProjectListProps) {
  const [search, setSearch] = useState('')

  const filtered = initialProjects.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.client_company_name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outsail-gray-600 pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by company name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Project list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-outsail-teal-light flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-7 h-7 text-outsail-teal" />
            </div>
            <h3 className="text-header-sm text-outsail-navy mb-2">
              {initialProjects.length === 0
                ? 'No projects yet'
                : 'No projects match your search'}
            </h3>
            <p className="text-body text-outsail-gray-600 mb-6 max-w-sm mx-auto">
              {initialProjects.length === 0
                ? 'Create your first Blueprint project to start capturing HR tech requirements.'
                : 'Try a different search term.'}
            </p>
            {initialProjects.length === 0 && (
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-medium text-white transition-colors bg-outsail-teal hover:bg-outsail-teal-dark"
              >
                <Plus className="w-4 h-4" />
                New Project
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-outsail-gray-200">
            {filtered.map((project) => {
              const statusVariant = (STATUS_BADGE_VARIANTS[project.status ?? 'setup'] ?? 'setup') as
                | 'setup'
                | 'intake'
                | 'chat'
                | 'review'
                | 'complete'
              const tierVariant = project.tier
                ? ((TIER_BADGE_VARIANTS[project.tier] ?? 'essentials') as
                    | 'essentials'
                    | 'growth'
                    | 'enterprise')
                : null

              const lastUpdated = formatRelativeDate(
                project.updated_at ?? project.created_at
              )

              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 hover:bg-outsail-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-outsail-navy">
                        {project.client_company_name}
                      </p>
                      <p className="text-xs text-outsail-gray-600">
                        &middot; {project.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusVariant}>
                        {STATUS_LABELS[project.status ?? 'setup'] ?? project.status}
                      </Badge>
                      {tierVariant && (
                        <Badge variant={tierVariant}>
                          {TIER_LABELS[project.tier ?? ''] ?? project.tier}
                        </Badge>
                      )}
                      {project.headcount && (
                        <span className="flex items-center gap-1 text-xs text-outsail-gray-600">
                          <Users className="w-3 h-3" />
                          {project.headcount.toLocaleString()} employees
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-outsail-gray-600">
                        <Clock className="w-3 h-3" />
                        {lastUpdated}
                      </span>
                      <span className="text-xs text-outsail-gray-600">
                        0% complete
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="ml-4 flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-outsail-teal border border-outsail-teal bg-transparent hover:bg-outsail-teal-light transition-colors"
                  >
                    Open
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

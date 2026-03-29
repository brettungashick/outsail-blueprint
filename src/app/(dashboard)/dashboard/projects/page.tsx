'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  FolderKanban,
  Clock,
  Users,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import type { ProjectStatus, ProjectTier } from '@/types'

interface Project {
  id: string
  name: string
  client_company_name: string
  client_contact_email: string
  headcount: number | null
  tier: ProjectTier | null
  status: ProjectStatus
  created_at: string | null
  updated_at: string | null
}

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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(data.projects ?? [])
        }
      } catch {
        // Non-fatal
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_company_name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statuses: Array<ProjectStatus | 'all'> = [
    'all',
    'setup',
    'intake',
    'chat',
    'review',
    'complete',
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-header-lg text-outsail-navy">Projects</h1>
          <p className="text-body text-outsail-gray-600 mt-1">
            Manage your Blueprint discovery projects.
          </p>
        </div>
        <Button variant="teal" size="default" asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outsail-gray-600 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-outsail-navy text-white'
                  : 'bg-white border border-outsail-gray-200 text-outsail-gray-600 hover:border-outsail-navy hover:text-outsail-navy'
              }`}
            >
              {status === 'all'
                ? 'All'
                : STATUS_LABELS[status as ProjectStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-card bg-outsail-gray-200 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-outsail-teal-light flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-7 h-7 text-outsail-teal" />
            </div>
            <h3 className="text-header-sm text-outsail-navy mb-2">
              {projects.length === 0
                ? 'No projects yet'
                : 'No projects match your filters'}
            </h3>
            <p className="text-body text-outsail-gray-600 mb-6 max-w-sm mx-auto">
              {projects.length === 0
                ? 'Create your first Blueprint project to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
            {projects.length === 0 && (
              <Button variant="teal" asChild>
                <Link href="/dashboard/projects/new">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-outsail-teal-light flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FolderKanban className="w-5 h-5 text-outsail-teal" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className="text-sm font-semibold text-outsail-navy truncate">
                            {project.name}
                          </h3>
                          <Badge
                            variant={
                              project.status as
                                | 'setup'
                                | 'intake'
                                | 'chat'
                                | 'review'
                                | 'complete'
                            }
                          >
                            {STATUS_LABELS[project.status]}
                          </Badge>
                          {project.tier && (
                            <Badge
                              variant={
                                project.tier as
                                  | 'essentials'
                                  | 'growth'
                                  | 'enterprise'
                              }
                            >
                              {TIER_LABELS[project.tier]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-outsail-gray-600 truncate">
                          {project.client_company_name} ·{' '}
                          {project.client_contact_email}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          {project.headcount && (
                            <span className="flex items-center gap-1 text-xs text-outsail-gray-600">
                              <Users className="w-3.5 h-3.5" />
                              {project.headcount.toLocaleString()} employees
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-outsail-gray-600">
                            <Clock className="w-3.5 h-3.5" />
                            Created{' '}
                            {formatDate(
                              project.created_at
                                ? new Date(project.created_at)
                                : null
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-outsail-gray-200 flex-shrink-0 mt-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

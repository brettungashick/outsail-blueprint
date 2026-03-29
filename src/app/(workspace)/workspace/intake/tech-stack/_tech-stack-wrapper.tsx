'use client'

import { useState } from 'react'
import { TechStackBuilder, TechStackSystemRow, IntegrationRow } from '@/components/tech-stack/tech-stack-builder'
import { TechStackViz } from '@/components/tech-stack/tech-stack-viz'

interface TechStackWrapperProps {
  projectId: string
  initialSystems: TechStackSystemRow[]
  initialIntegrations: IntegrationRow[]
  hasExistingData: boolean
}

export function TechStackBuilderWrapper({
  projectId,
  initialSystems,
  initialIntegrations,
  hasExistingData,
}: TechStackWrapperProps) {
  const [completed, setCompleted] = useState(hasExistingData)
  const [systems, setSystems] = useState<TechStackSystemRow[]>(initialSystems)
  const [ints, setInts] = useState<IntegrationRow[]>(initialIntegrations)

  async function handleComplete() {
    // Re-fetch from API to get updated data with server-assigned IDs
    try {
      const res = await fetch(`/api/projects/${projectId}/tech-stack`)
      if (res.ok) {
        const data = await res.json() as {
          systems: Array<{
            id: string
            system_name: string
            vendor: string | null
            system_type: string | null
            is_primary: boolean | null
            modules_used: string | null
            experience_rating: number | null
            notes: string | null
          }>
          integrations: Array<{
            source_system_id: string
            target_system_id: string
            integration_quality: string
          }>
        }

        const parsed = data.systems.map((s) => {
          let modules: string[] = []
          try { if (s.modules_used) modules = JSON.parse(s.modules_used) as string[] } catch { /* empty */ }
          let ratings = { admin: 3, employee: 3, service: 3 }
          try {
            if (s.notes) {
              const n = JSON.parse(s.notes) as { ratings?: typeof ratings }
              if (n.ratings) ratings = n.ratings
            }
          } catch { /* empty */ }
          return {
            id: s.id,
            system_name: s.system_name,
            vendor: s.vendor,
            system_type: s.system_type,
            is_primary: s.is_primary ?? false,
            modules_used: modules,
            ratings,
            experience_rating: s.experience_rating,
          }
        })

        const parsedInts = data.integrations.map((i) => ({
          source_id: i.source_system_id,
          target_id: i.target_system_id,
          quality: i.integration_quality as IntegrationRow['quality'],
        }))

        setSystems(parsed)
        setInts(parsedInts)
      }
    } catch { /* use existing data */ }

    setCompleted(true)
  }

  if (completed && systems.length > 0) {
    return (
      <div className="space-y-8">
        {/* Saved banner */}
        <div className="flex items-center justify-between p-4 bg-outsail-teal/5 border border-outsail-teal/20 rounded-card">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-outsail-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-label text-outsail-teal font-medium">Tech stack saved successfully</p>
          </div>
          <button
            type="button"
            onClick={() => setCompleted(false)}
            className="text-label text-outsail-gray-600 hover:text-outsail-navy transition-colors"
          >
            Edit
          </button>
        </div>

        {/* Visualization */}
        <div className="outsail-card">
          <h2 className="text-header-sm text-outsail-navy mb-4">Your Tech Stack Map</h2>
          <TechStackViz systems={systems} integrations={ints} />
        </div>

        {/* Next step */}
        <div className="flex justify-end">
          <a
            href="/workspace"
            className="px-6 py-2.5 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 transition-colors"
          >
            Back to Workspace
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="outsail-card">
      <TechStackBuilder
        projectId={projectId}
        initialSystems={systems}
        initialIntegrations={ints}
        onComplete={handleComplete}
      />
    </div>
  )
}

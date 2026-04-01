'use client'

import { useRouter } from 'next/navigation'
import { TechStackCanvas } from '@/components/tech-stack/tech-stack-canvas'

type IntegrationQuality = 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual'
type IntegrationDirection = 'to_primary' | 'from_primary' | 'bidirectional'

interface TechStackSystemRow {
  id?: string
  system_name: string
  vendor: string | null
  system_type: string | null
  is_primary: boolean
  modules_used: string[]
  ratings: { admin: number; employee: number; service: number }
  experience_rating: number | null
  integrationDirection?: IntegrationDirection
  vendorNotes?: string
  alsoCoversLabels?: string[]
  isCustom?: boolean
  customModules?: string[]
}

interface ParsedIntegration {
  source_id: string
  target_id: string
  quality: IntegrationQuality
}

interface TechStackWrapperProps {
  projectId: string
  initialSystems: TechStackSystemRow[]
  initialIntegrations: ParsedIntegration[]
  hasExistingData: boolean
}

interface PointSolutionData {
  vendor: string
  ratings: { admin: number; employee: number; service: number }
  alsoCovers: string[]
  notes: string
  integrationQuality: IntegrationQuality
  integrationDirection: IntegrationDirection
}

export function TechStackBuilderWrapper({
  projectId,
  initialSystems,
  initialIntegrations,
}: TechStackWrapperProps) {
  const router = useRouter()

  const primary = initialSystems.find((s) => s.is_primary)

  // Build quality map: source_id → integration quality
  const qualityMap: Record<string, IntegrationQuality> = {}
  for (const intg of initialIntegrations) {
    qualityMap[intg.source_id] = intg.quality
  }

  // Reconstruct point solutions grouped by primary module label
  const initialPointSolutions: Record<string, PointSolutionData[]> = {}
  for (const s of initialSystems) {
    if (s.is_primary) continue
    const primaryModuleLabel = s.modules_used[0]
    if (!primaryModuleLabel) continue

    const solution: PointSolutionData = {
      vendor: s.vendor ?? s.system_name,
      ratings: s.ratings,
      alsoCovers: s.alsoCoversLabels ?? s.modules_used.slice(1),
      notes: s.vendorNotes ?? '',
      integrationQuality: (s.id ? qualityMap[s.id] : undefined) ?? 'mostly_automated',
      integrationDirection: s.integrationDirection ?? 'bidirectional',
    }

    if (!initialPointSolutions[primaryModuleLabel]) {
      initialPointSolutions[primaryModuleLabel] = []
    }
    initialPointSolutions[primaryModuleLabel].push(solution)
  }

  // Custom modules are stored in the primary system's notes
  const initialCustomModules = primary?.customModules ?? []

  return (
    <TechStackCanvas
      projectId={projectId}
      initialPrimaryVendor={primary?.vendor ?? ''}
      initialCoveredModules={primary?.modules_used ?? []}
      initialPointSolutions={initialPointSolutions}
      initialCustomModules={initialCustomModules}
      onComplete={() => router.push('/workspace/intake/discovery')}
    />
  )
}

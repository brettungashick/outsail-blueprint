'use client'

import { useRouter } from 'next/navigation'
import { TechStackCanvas } from '@/components/tech-stack/tech-stack-canvas'

interface TechStackSystemRow {
  id?: string
  system_name: string
  vendor: string | null
  system_type: string | null
  is_primary: boolean
  modules_used: string[]
  ratings: { admin: number; employee: number; service: number }
  experience_rating: number | null
}

interface TechStackWrapperProps {
  projectId: string
  initialSystems: TechStackSystemRow[]
  initialIntegrations: unknown[]
  hasExistingData: boolean
}

export function TechStackBuilderWrapper({
  projectId,
  initialSystems,
}: TechStackWrapperProps) {
  const router = useRouter()

  const primary = initialSystems.find((s) => s.is_primary)

  return (
    <TechStackCanvas
      projectId={projectId}
      initialPrimaryVendor={primary?.vendor ?? ''}
      initialCoveredModules={primary?.modules_used ?? []}
      onComplete={() => router.push('/workspace/intake/discovery')}
    />
  )
}

'use client'

import { useState } from 'react'
import { VendorCombobox } from './vendor-combobox'
import { StarRating } from './star-rating'
import { HCM_CAPABILITIES, VENDOR_DEFAULT_MODULES } from '@/lib/tech-stack/vendors'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export interface TechStackSystemRow {
  id?: string
  system_name: string
  vendor: string | null
  system_type: string | null
  is_primary: boolean
  modules_used: string[]
  ratings: { admin: number; employee: number; service: number }
  experience_rating: number | null
}

export interface IntegrationRow {
  source_id: string
  target_id: string
  quality: 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual'
}

interface TechStackBuilderProps {
  projectId: string
  initialSystems?: TechStackSystemRow[]
  initialIntegrations?: IntegrationRow[]
  onComplete?: () => void
}

type IntegrationQuality = IntegrationRow['quality']

// ----------------------------------------------------------------
// Category → system_type mapping for DB storage
// ----------------------------------------------------------------
const CATEGORY_TO_SYSTEM_TYPE: Record<string, string> = {
  'Payroll': 'payroll',
  'Benefits Admin': 'benefits',
  'Time & Attendance': 'scheduling',
  'Onboarding': 'other',
  'Core HR': 'primary_hris',
  'Performance': 'performance',
  'Compensation': 'other',
  'Learning/LMS': 'lms',
  'Recruiting/ATS': 'ats',
  'AI': 'point_solution',
  'Expense': 'point_solution',
  'SSO': 'point_solution',
  'ERP/General Ledger': 'point_solution',
  'Global Payroll': 'payroll',
  'Custom': 'other',
}

const INTEGRATION_OPTIONS: Array<{
  value: IntegrationQuality
  label: string
  icon: string
  color: string
  borderColor: string
  bgColor: string
}> = [
  { value: 'fully_integrated', label: 'Fully Integrated', icon: '✅', color: 'text-outsail-teal', borderColor: 'border-outsail-teal', bgColor: 'bg-outsail-teal/5' },
  { value: 'mostly_automated', label: 'Mostly Automated', icon: '🔄', color: 'text-outsail-amber', borderColor: 'border-outsail-amber', bgColor: 'bg-outsail-amber/5' },
  { value: 'partially_automated', label: 'Partially Automated', icon: '⚡', color: 'text-outsail-coral', borderColor: 'border-outsail-coral', bgColor: 'bg-outsail-coral/5' },
  { value: 'fully_manual', label: 'Fully Manual', icon: '📋', color: 'text-red-500', borderColor: 'border-red-300', bgColor: 'bg-red-50' },
]

// ----------------------------------------------------------------
// Point Solution form state
// ----------------------------------------------------------------
interface PointSolutionDraft {
  tempId: string
  vendor: string
  category: string
  modules_used: string[]
  ratings: { admin: number; employee: number; service: number }
}

// ----------------------------------------------------------------
// Step progress indicator
// ----------------------------------------------------------------
function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              step < current
                ? 'bg-outsail-teal text-white'
                : step === current
                ? 'border-2 border-outsail-teal text-outsail-teal bg-white'
                : 'border-2 border-outsail-gray-200 text-outsail-gray-600 bg-white'
            }`}
          >
            {step < current ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              step
            )}
          </div>
          {step < total && (
            <div className={`w-8 h-0.5 ${step < current ? 'bg-outsail-teal' : 'bg-outsail-gray-200'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-label text-outsail-gray-600">Step {current} of {total}</span>
    </div>
  )
}

// ----------------------------------------------------------------
// Main TechStackBuilder
// ----------------------------------------------------------------
export function TechStackBuilder({
  projectId,
  initialSystems = [],
  initialIntegrations: _initialIntegrations = [],
  onComplete,
}: TechStackBuilderProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Primary system state
  const [primaryVendor, setPrimaryVendor] = useState(
    initialSystems.find((s) => s.is_primary)?.vendor ?? ''
  )
  const [primaryModules, setPrimaryModules] = useState<string[]>(
    initialSystems.find((s) => s.is_primary)?.modules_used ??
      (primaryVendor ? (VENDOR_DEFAULT_MODULES[primaryVendor] ?? []) : [])
  )
  const [primaryRatings, setPrimaryRatings] = useState<{ admin: number; employee: number; service: number }>(
    initialSystems.find((s) => s.is_primary)?.ratings ?? { admin: 4, employee: 3, service: 4 }
  )

  // Point solutions state
  const [pointSolutions, setPointSolutions] = useState<PointSolutionDraft[]>(
    initialSystems
      .filter((s) => !s.is_primary)
      .map((s) => ({
        tempId: s.id ?? String(Math.random()),
        vendor: s.vendor ?? s.system_name,
        category: s.system_type ?? 'other',
        modules_used: s.modules_used,
        ratings: s.ratings,
      }))
  )

  // Integration state: tempId → quality
  const [integrationMap, setIntegrationMap] = useState<Record<string, IntegrationQuality>>(() => {
    const map: Record<string, IntegrationQuality> = {}
    pointSolutions.forEach((ps) => {
      map[ps.tempId] = 'partially_automated'
    })
    return map
  })

  // Adding new point solution
  const [addingNew, setAddingNew] = useState(false)
  const [newSolution, setNewSolution] = useState<Omit<PointSolutionDraft, 'tempId'>>({
    vendor: '',
    category: 'Recruiting/ATS',
    modules_used: [],
    ratings: { admin: 3, employee: 3, service: 3 },
  })

  // ----------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------
  function handlePrimaryVendorChange(v: string) {
    setPrimaryVendor(v)
    const defaults = VENDOR_DEFAULT_MODULES[v] ?? []
    setPrimaryModules(defaults)
  }

  function toggleModule(capability: string, current: string[], setter: (m: string[]) => void) {
    if (current.includes(capability)) {
      setter(current.filter((c) => c !== capability))
    } else {
      setter([...current, capability])
    }
  }

  function addPointSolution() {
    if (!newSolution.vendor.trim()) return
    const tempId = String(Date.now())
    const ps: PointSolutionDraft = { ...newSolution, tempId }
    setPointSolutions((prev) => [...prev, ps])
    setIntegrationMap((prev) => ({ ...prev, [tempId]: 'partially_automated' }))
    setNewSolution({ vendor: '', category: 'Recruiting/ATS', modules_used: [], ratings: { admin: 3, employee: 3, service: 3 } })
    setAddingNew(false)
  }

  function removePointSolution(tempId: string) {
    setPointSolutions((prev) => prev.filter((ps) => ps.tempId !== tempId))
    setIntegrationMap((prev) => {
      const next = { ...prev }
      delete next[tempId]
      return next
    })
  }

  // Modules not covered by primary platform
  const uncoveredCategories = HCM_CAPABILITIES.filter(
    (cap) => !primaryModules.includes(cap) && cap !== 'Custom'
  )

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
  async function handleSubmit() {
    setLoading(true)
    setError(null)

    try {
      const primaryRes = await fetch(`/api/projects/${projectId}/tech-stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_name: primaryVendor || 'Primary HRIS',
          vendor: primaryVendor || null,
          is_primary: true,
          modules_used: primaryModules,
          ratings: primaryRatings,
          system_type: 'primary_hris',
        }),
      })

      if (!primaryRes.ok) throw new Error('Failed to save primary system')
      const { systemId: primaryId } = await primaryRes.json() as { systemId: string }

      const satelliteIds: Record<string, string> = {}
      for (const ps of pointSolutions) {
        const res = await fetch(`/api/projects/${projectId}/tech-stack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_name: ps.vendor,
            vendor: ps.vendor,
            is_primary: false,
            modules_used: ps.modules_used.length > 0 ? ps.modules_used : [ps.category],
            ratings: ps.ratings,
            system_type: CATEGORY_TO_SYSTEM_TYPE[ps.category] ?? 'point_solution',
          }),
        })
        if (!res.ok) throw new Error(`Failed to save ${ps.vendor}`)
        const { systemId } = await res.json() as { systemId: string }
        satelliteIds[ps.tempId] = systemId
      }

      const integrationPayload = pointSolutions.map((ps) => ({
        source_id: satelliteIds[ps.tempId],
        target_id: primaryId,
        quality: integrationMap[ps.tempId] ?? 'partially_automated',
      }))

      const intRes = await fetch(`/api/projects/${projectId}/tech-stack/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrations: integrationPayload }),
      })

      if (!intRes.ok) throw new Error('Failed to save integrations')

      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Step 1: Primary Vendor
  // ----------------------------------------------------------------
  function Step1() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-header-sm text-outsail-navy mb-1">Your primary HR platform</h2>
          <p className="text-body text-outsail-gray-600">
            This is the system your HR team relies on most for core employee data.
          </p>
        </div>
        <div className="max-w-md">
          <label className="block text-label text-outsail-navy mb-2">HR Platform</label>
          <VendorCombobox
            value={primaryVendor}
            onChange={handlePrimaryVendorChange}
            placeholder="Search for your HR platform..."
            canBePrimary={true}
          />
          <p className="text-xs text-outsail-gray-600 mt-2">
            Can&apos;t find your system? Type the name and select the custom entry option.
          </p>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // Step 2: Confirm Modules
  // ----------------------------------------------------------------
  function Step2() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-header-sm text-outsail-navy mb-1">
            Which modules does {primaryVendor || 'your platform'} cover for you?
          </h2>
          <p className="text-body text-outsail-gray-600">
            Select all capabilities you actively use in this system.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HCM_CAPABILITIES.map((cap) => {
            const checked = primaryModules.includes(cap)
            return (
              <button
                key={cap}
                type="button"
                onClick={() => toggleModule(cap, primaryModules, setPrimaryModules)}
                className={`flex items-center gap-3 p-3 rounded-card border-2 text-left transition-all ${
                  checked
                    ? 'border-outsail-teal bg-outsail-teal/5 text-outsail-navy'
                    : 'border-outsail-gray-200 bg-white text-outsail-gray-600 hover:border-outsail-teal/40'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                    checked ? 'bg-outsail-teal border-outsail-teal' : 'border-outsail-gray-200 bg-white'
                  }`}
                >
                  {checked && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-label">{cap}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // Step 3: Rate Experience
  // ----------------------------------------------------------------
  function Step3() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-header-sm text-outsail-navy mb-1">
            How would you rate {primaryVendor || 'your platform'} for...
          </h2>
          <p className="text-body text-outsail-gray-600">
            Rate your overall satisfaction (1 = poor, 5 = excellent).
          </p>
        </div>
        <div className="outsail-card max-w-md space-y-4">
          <StarRating
            label="HR / Admin experience"
            value={primaryRatings.admin}
            onChange={(v) => setPrimaryRatings((r) => ({ ...r, admin: v }))}
          />
          <StarRating
            label="Employee self-service experience"
            value={primaryRatings.employee}
            onChange={(v) => setPrimaryRatings((r) => ({ ...r, employee: v }))}
          />
          <StarRating
            label="Support & service quality"
            value={primaryRatings.service}
            onChange={(v) => setPrimaryRatings((r) => ({ ...r, service: v }))}
          />
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // Step 4: Add Point Solutions
  // ----------------------------------------------------------------
  function Step4() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-header-sm text-outsail-navy mb-1">Add point solutions</h2>
          <p className="text-body text-outsail-gray-600">
            Other HR tools you use alongside {primaryVendor || 'your primary platform'}.
          </p>
        </div>

        {uncoveredCategories.length > 0 && (
          <div className="rounded-card border border-outsail-gray-200 p-4 bg-outsail-gray-50">
            <p className="text-label text-outsail-navy mb-2">
              Modules not covered by {primaryVendor || 'your primary platform'}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {uncoveredCategories.map((cat) => (
                <span key={cat} className="text-xs bg-white border border-outsail-gray-200 px-2 py-0.5 rounded-full text-outsail-gray-600">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {pointSolutions.length > 0 && (
          <div className="space-y-3">
            {pointSolutions.map((ps) => {
              const avgRating = Math.round((ps.ratings.admin + ps.ratings.employee + ps.ratings.service) / 3)
              return (
                <div key={ps.tempId} className="outsail-card relative">
                  <button
                    type="button"
                    onClick={() => removePointSolution(ps.tempId)}
                    className="absolute top-4 right-4 text-outsail-gray-600 hover:text-outsail-coral transition-colors text-lg leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                  <div className="flex items-start gap-3">
                    <div>
                      <p className="text-sm font-semibold text-outsail-navy">{ps.vendor}</p>
                      <p className="text-xs text-outsail-gray-600 mt-0.5">{ps.category}</p>
                    </div>
                    <div className="ml-auto mr-8 flex items-center gap-1 text-outsail-amber">
                      <span>{'★'.repeat(avgRating)}{'☆'.repeat(5 - avgRating)}</span>
                      <span className="text-xs text-outsail-gray-600 ml-1">{avgRating}/5</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {addingNew ? (
          <div className="outsail-card space-y-4 border-2 border-outsail-teal/20">
            <h3 className="text-label text-outsail-navy font-semibold">New point solution</h3>

            <div>
              <label className="block text-label text-outsail-gray-600 mb-1">Category</label>
              <select
                value={newSolution.category}
                onChange={(e) =>
                  setNewSolution((s) => ({ ...s, category: e.target.value, vendor: '', modules_used: [] }))
                }
                className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
              >
                {HCM_CAPABILITIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-label text-outsail-gray-600 mb-1">Vendor / System Name</label>
              <VendorCombobox
                key={newSolution.category}
                value={newSolution.vendor}
                onChange={(v) => setNewSolution((s) => ({ ...s, vendor: v }))}
                placeholder="Search or type system name..."
                category={newSolution.category}
              />
            </div>

            <div className="space-y-3">
              <label className="block text-label text-outsail-gray-600">Ratings</label>
              <StarRating label="Admin experience" value={newSolution.ratings.admin} onChange={(v) => setNewSolution((s) => ({ ...s, ratings: { ...s.ratings, admin: v } }))} />
              <StarRating label="Employee experience" value={newSolution.ratings.employee} onChange={(v) => setNewSolution((s) => ({ ...s, ratings: { ...s.ratings, employee: v } }))} />
              <StarRating label="Service quality" value={newSolution.ratings.service} onChange={(v) => setNewSolution((s) => ({ ...s, ratings: { ...s.ratings, service: v } }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={addPointSolution}
                disabled={!newSolution.vendor.trim()}
                className="px-4 py-2 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add System
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingNew(false)
                  setNewSolution({ vendor: '', category: 'Recruiting/ATS', modules_used: [], ratings: { admin: 3, employee: 3, service: 3 } })
                }}
                className="px-4 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-label hover:border-outsail-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-outsail-gray-200 rounded-card text-label text-outsail-gray-600 hover:border-outsail-teal hover:text-outsail-teal transition-colors w-full justify-center"
          >
            <span className="text-lg leading-none">+</span>
            Add a point solution
          </button>
        )}
      </div>
    )
  }

  // ----------------------------------------------------------------
  // Step 5: Map Integrations
  // ----------------------------------------------------------------
  function Step5() {
    if (pointSolutions.length === 0) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-header-sm text-outsail-navy mb-1">Integration mapping</h2>
            <p className="text-body text-outsail-gray-600">No point solutions added — nothing to map.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-header-sm text-outsail-navy mb-1">Map integrations</h2>
          <p className="text-body text-outsail-gray-600">
            How does each system connect to {primaryVendor || 'your primary platform'}?
          </p>
        </div>

        <div className="space-y-4">
          {pointSolutions.map((ps) => {
            const selected = integrationMap[ps.tempId] ?? 'partially_automated'
            return (
              <div key={ps.tempId} className="outsail-card">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-semibold text-outsail-navy text-sm">{ps.vendor}</span>
                  <span className="text-xs text-outsail-gray-600 bg-outsail-gray-50 border border-outsail-gray-200 px-1.5 py-0.5 rounded-full">{ps.category}</span>
                  <span className="text-outsail-gray-200 mx-1">↔</span>
                  <span className="text-outsail-gray-600 text-sm">{primaryVendor || 'Primary Platform'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {INTEGRATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setIntegrationMap((prev) => ({ ...prev, [ps.tempId]: opt.value }))
                      }
                      className={`flex items-center gap-2 p-3 rounded-card border-2 text-left transition-all text-xs font-medium ${
                        selected === opt.value
                          ? `${opt.borderColor} ${opt.bgColor} ${opt.color}`
                          : 'border-outsail-gray-200 text-outsail-gray-600 hover:border-outsail-gray-200/60 bg-white'
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------------
  const canProceed = step === 1 ? primaryVendor.trim().length > 0 : true

  return (
    <div className="space-y-6">
      <StepProgress current={step} total={5} />

      <div className="min-h-[320px]">
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
        {step === 5 && <Step5 />}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-outsail-gray-200">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={loading}
            className="px-4 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-label hover:border-outsail-navy transition-colors disabled:opacity-40"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
            className="px-5 py-2 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

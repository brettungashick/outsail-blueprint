'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface InitialValues {
  company_name?: string
  headcount_current?: number
  headcount_projected?: number
  hq_location?: string
  additional_locations?: string[]
  workforce_salaried_pct?: number
  workforce_fulltime_pct?: number
  ownership_structure?: string
  industry?: string
  growth_notes?: string
}

interface CompanyProfileFormProps {
  projectId: string
  initialValues: InitialValues
}

const OWNERSHIP_OPTIONS = [
  { value: 'public', label: 'Public Company' },
  { value: 'private_pe', label: 'Private — PE-Backed' },
  { value: 'private_vc', label: 'Private — VC-Backed' },
  { value: 'private_bootstrap', label: 'Private — Bootstrapped' },
  { value: 'nonprofit', label: 'Nonprofit / Public Sector' },
]

export function CompanyProfileForm({ projectId, initialValues }: CompanyProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState(initialValues.company_name ?? '')
  const [headcountCurrent, setHeadcountCurrent] = useState<string>(
    initialValues.headcount_current != null ? String(initialValues.headcount_current) : ''
  )
  const [headcountProjected, setHeadcountProjected] = useState<string>(
    initialValues.headcount_projected != null ? String(initialValues.headcount_projected) : ''
  )
  const [hqLocation, setHqLocation] = useState(initialValues.hq_location ?? '')
  const [additionalLocations, setAdditionalLocations] = useState<string[]>(
    initialValues.additional_locations ?? []
  )
  const [workforceSalaried, setWorkforceSalaried] = useState<string>(
    initialValues.workforce_salaried_pct != null ? String(initialValues.workforce_salaried_pct) : ''
  )
  const [workforceFulltime, setWorkforceFulltime] = useState<string>(
    initialValues.workforce_fulltime_pct != null ? String(initialValues.workforce_fulltime_pct) : ''
  )
  const [ownershipStructure, setOwnershipStructure] = useState(initialValues.ownership_structure ?? '')
  const [industry, setIndustry] = useState(initialValues.industry ?? '')
  const [growthNotes, setGrowthNotes] = useState(initialValues.growth_notes ?? '')

  function addLocation() {
    setAdditionalLocations((prev) => [...prev, ''])
  }

  function removeLocation(index: number) {
    setAdditionalLocations((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLocation(index: number, value: string) {
    setAdditionalLocations((prev) => prev.map((loc, i) => (i === index ? value : loc)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const body = {
        company_name: companyName || undefined,
        headcount_current: headcountCurrent ? parseInt(headcountCurrent, 10) : undefined,
        headcount_projected: headcountProjected ? parseInt(headcountProjected, 10) : undefined,
        hq_location: hqLocation || undefined,
        additional_locations: additionalLocations.filter((l) => l.trim()),
        workforce_salaried_pct: workforceSalaried ? parseFloat(workforceSalaried) : undefined,
        workforce_fulltime_pct: workforceFulltime ? parseFloat(workforceFulltime) : undefined,
        ownership_structure: ownershipStructure || undefined,
        industry: industry || undefined,
        growth_notes: growthNotes || undefined,
      }

      const res = await fetch(`/api/projects/${projectId}/company-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to save company profile')
      }

      router.push('/workspace/intake/tech-stack')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="outsail-card space-y-5">
        {/* Company Name */}
        <div>
          <label className="block text-label text-outsail-navy mb-1.5">
            Company Name <span className="text-outsail-coral">*</span>
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
          />
        </div>

        {/* Headcount row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-label text-outsail-navy mb-1.5">Current Headcount</label>
            <input
              type="number"
              min={1}
              value={headcountCurrent}
              onChange={(e) => setHeadcountCurrent(e.target.value)}
              placeholder="500"
              className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
            />
          </div>
          <div>
            <label className="block text-label text-outsail-navy mb-1.5">Projected Headcount in 3 Years</label>
            <input
              type="number"
              min={1}
              value={headcountProjected}
              onChange={(e) => setHeadcountProjected(e.target.value)}
              placeholder="750"
              className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
            />
          </div>
        </div>

        {/* HQ Location */}
        <div>
          <label className="block text-label text-outsail-navy mb-1.5">Primary HQ Location</label>
          <input
            type="text"
            value={hqLocation}
            onChange={(e) => setHqLocation(e.target.value)}
            placeholder="San Francisco, CA"
            className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
          />
        </div>

        {/* Additional Locations */}
        <div>
          <label className="block text-label text-outsail-navy mb-1.5">Additional Locations</label>
          <div className="space-y-2">
            {additionalLocations.map((loc, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={loc}
                  onChange={(e) => updateLocation(i, e.target.value)}
                  placeholder={`Location ${i + 2}`}
                  className="flex-1 px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeLocation(i)}
                  className="w-8 h-8 flex items-center justify-center text-outsail-gray-600 hover:text-outsail-coral rounded transition-colors flex-shrink-0"
                  aria-label="Remove location"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLocation}
              className="flex items-center gap-1.5 text-label text-outsail-teal hover:text-outsail-teal/80 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Add Location
            </button>
          </div>
        </div>

        {/* Workforce composition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-label text-outsail-navy mb-1.5">
              Workforce % Salaried
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                value={workforceSalaried}
                onChange={(e) => setWorkforceSalaried(e.target.value)}
                placeholder="70"
                className="w-full px-3 py-2 pr-8 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-outsail-gray-600 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-label text-outsail-navy mb-1.5">
              Workforce % Full-Time
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                value={workforceFulltime}
                onChange={(e) => setWorkforceFulltime(e.target.value)}
                placeholder="85"
                className="w-full px-3 py-2 pr-8 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-outsail-gray-600 text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Ownership Structure */}
        <div>
          <label className="block text-label text-outsail-navy mb-1.5">Ownership Structure</label>
          <select
            value={ownershipStructure}
            onChange={(e) => setOwnershipStructure(e.target.value)}
            className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
          >
            <option value="">Select ownership type...</option>
            {OWNERSHIP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Industry */}
        <div>
          <label className="block text-label text-outsail-navy mb-1.5">Industry</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Technology, Healthcare, Manufacturing"
            className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
          />
        </div>

        {/* Growth Notes */}
        <div>
          <label className="block text-label text-outsail-navy mb-1.5">Growth Notes</label>
          <textarea
            value={growthNotes}
            onChange={(e) => setGrowthNotes(e.target.value)}
            placeholder="Describe any planned growth, acquisitions, or strategic changes..."
            rows={4}
            className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving || !companyName.trim()}
          className="px-6 py-2.5 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving ? (
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
        <button
          type="button"
          onClick={() => router.push('/workspace/intake/tech-stack')}
          className="text-label text-outsail-gray-600 hover:text-outsail-navy transition-colors"
        >
          Skip for now
        </button>
      </div>
    </form>
  )
}

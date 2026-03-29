'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface InitialValues {
  company_name?: string
  headcount_current?: number
  headcount_projected?: number
  hq_city?: string
  hq_state?: string
  hq_country?: string
  is_multi_state?: boolean
  multi_state_count?: number
  has_international?: boolean
  international_employment_types?: string[]
  workforce_salaried_pct?: number
  workforce_fulltime_pct?: number
  ownership_structure?: string
  industry?: string
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

const INDUSTRY_OPTIONS = [
  'Technology / Software',
  'Healthcare / Life Sciences',
  'Financial Services / Banking',
  'Manufacturing / Industrial',
  'Retail / Consumer Goods',
  'Professional Services / Consulting',
  'Media / Entertainment',
  'Education',
  'Nonprofit / Government',
  'Real Estate / Construction',
  'Energy / Utilities',
  'Transportation / Logistics',
  'Hospitality / Travel',
  'Insurance',
  'Legal Services',
  'Agriculture / Food & Beverage',
  'Pharmaceuticals / Biotech',
  'Other',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany',
  'France', 'Netherlands', 'Ireland', 'India', 'Singapore',
  'Japan', 'Brazil', 'Mexico', 'Spain', 'Italy',
  'Sweden', 'Denmark', 'Norway', 'Finland', 'Switzerland',
  'Belgium', 'Poland', 'Czech Republic', 'Hungary', 'Romania',
  'South Africa', 'United Arab Emirates', 'Israel', 'New Zealand',
  'Philippines', 'Malaysia', 'Indonesia', 'South Korea', 'China',
  'Other',
]

const INTL_EMPLOYMENT_TYPES = [
  { value: 'legal_entity', label: 'We have legal entities abroad' },
  { value: 'eor', label: 'We use an EOR (like Deel, Remote, etc.)' },
  { value: 'contractors', label: 'Contractors only' },
  { value: 'mix', label: 'Mix of the above' },
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

  // Location fields
  const [hqCity, setHqCity] = useState(initialValues.hq_city ?? '')
  const [hqCountry, setHqCountry] = useState(initialValues.hq_country ?? 'United States')
  const [hqState, setHqState] = useState(initialValues.hq_state ?? '')
  const [isMultiState, setIsMultiState] = useState(initialValues.is_multi_state ?? false)
  const [multiStateCount, setMultiStateCount] = useState<string>(
    initialValues.multi_state_count != null ? String(initialValues.multi_state_count) : ''
  )
  const [hasInternational, setHasInternational] = useState(initialValues.has_international ?? false)
  const [intlEmploymentTypes, setIntlEmploymentTypes] = useState<string[]>(
    initialValues.international_employment_types ?? []
  )

  const [workforceSalaried, setWorkforceSalaried] = useState<string>(
    initialValues.workforce_salaried_pct != null ? String(initialValues.workforce_salaried_pct) : ''
  )
  const [workforceFulltime, setWorkforceFulltime] = useState<string>(
    initialValues.workforce_fulltime_pct != null ? String(initialValues.workforce_fulltime_pct) : ''
  )
  const [ownershipStructure, setOwnershipStructure] = useState(initialValues.ownership_structure ?? '')
  const [industry, setIndustry] = useState(initialValues.industry ?? '')

  const isUS = hqCountry === 'United States'

  function toggleIntlType(value: string) {
    setIntlEmploymentTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    )
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
        hq_city: hqCity || undefined,
        hq_country: hqCountry || undefined,
        hq_state: isUS ? (hqState || undefined) : undefined,
        is_multi_state: isUS ? isMultiState : undefined,
        multi_state_count: isUS && isMultiState && multiStateCount ? parseInt(multiStateCount, 10) : undefined,
        has_international: hasInternational,
        international_employment_types: hasInternational ? intlEmploymentTypes : undefined,
        workforce_salaried_pct: workforceSalaried ? parseFloat(workforceSalaried) : undefined,
        workforce_fulltime_pct: workforceFulltime ? parseFloat(workforceFulltime) : undefined,
        ownership_structure: ownershipStructure || undefined,
        industry: industry || undefined,
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
            <label className="block text-label text-outsail-navy mb-1.5">Projected Headcount (3 Years)</label>
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

        {/* ── HQ Location ── */}
        <div className="space-y-4">
          <p className="text-label text-outsail-navy font-semibold">HQ Location</p>

          {/* City + Country row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label text-outsail-navy mb-1.5">City</label>
              <input
                type="text"
                value={hqCity}
                onChange={(e) => setHqCity(e.target.value)}
                placeholder="San Francisco"
                className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
              />
            </div>
            <div>
              <label className="block text-label text-outsail-navy mb-1.5">Country</label>
              <select
                value={hqCountry}
                onChange={(e) => {
                  setHqCountry(e.target.value)
                  setHqState('')
                  setIsMultiState(false)
                  setMultiStateCount('')
                }}
                className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* US-specific: State + multi-state */}
          {isUS && (
            <div className="space-y-4 pl-4 border-l-2 border-outsail-teal/20">
              <div>
                <label className="block text-label text-outsail-navy mb-1.5">State</label>
                <select
                  value={hqState}
                  onChange={(e) => setHqState(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Multi-state question */}
              <div>
                <p className="text-label text-outsail-navy mb-2">Are you operating in multiple states?</p>
                <div className="flex gap-4">
                  {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }] as const).map(({ v, l }) => (
                    <label key={l} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="multi_state"
                        checked={isMultiState === v}
                        onChange={() => {
                          setIsMultiState(v)
                          if (!v) setMultiStateCount('')
                        }}
                        className="accent-outsail-teal"
                      />
                      <span className="text-body text-outsail-slate">{l}</span>
                    </label>
                  ))}
                </div>
                {isMultiState && (
                  <div className="mt-3">
                    <label className="block text-label text-outsail-navy mb-1.5">How many states?</label>
                    <input
                      type="number"
                      min={2}
                      value={multiStateCount}
                      onChange={(e) => setMultiStateCount(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-32 px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* International employees */}
          <div>
            <p className="text-label text-outsail-navy mb-2">
              Do you have employees outside of {hqCountry || 'your country'}?
            </p>
            <div className="flex gap-4">
              {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }] as const).map(({ v, l }) => (
                <label key={l} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="has_international"
                    checked={hasInternational === v}
                    onChange={() => {
                      setHasInternational(v)
                      if (!v) setIntlEmploymentTypes([])
                    }}
                    className="accent-outsail-teal"
                  />
                  <span className="text-body text-outsail-slate">{l}</span>
                </label>
              ))}
            </div>

            {hasInternational && (
              <div className="mt-3 pl-4 border-l-2 border-outsail-teal/20 space-y-2.5">
                <p className="text-label text-outsail-navy">How do you employ people internationally?</p>
                {INTL_EMPLOYMENT_TYPES.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      role="checkbox"
                      aria-checked={intlEmploymentTypes.includes(value)}
                      tabIndex={0}
                      onClick={() => toggleIntlType(value)}
                      onKeyDown={(e) => e.key === ' ' && toggleIntlType(value)}
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                        intlEmploymentTypes.includes(value)
                          ? 'bg-outsail-teal border-outsail-teal'
                          : 'border-outsail-gray-200 bg-white'
                      }`}
                    >
                      {intlEmploymentTypes.includes(value) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-body text-outsail-slate">{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Workforce composition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-label text-outsail-navy mb-1.5">Workforce % Salaried</label>
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
            <label className="block text-label text-outsail-navy mb-1.5">Workforce % Full-Time</label>
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
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
          >
            <option value="">Select industry...</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
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

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Mail, Users, FileText, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Tier = 'essentials' | 'growth' | 'enterprise'

function suggestTier(headcount: number): Tier {
  if (headcount <= 100) return 'essentials'
  if (headcount <= 500) return 'growth'
  return 'enterprise'
}

const TIER_INFO: Record<Tier, { label: string; range: string; depth: string; color: string }> = {
  essentials: {
    label: 'Essentials',
    range: '1–100 employees',
    depth: 'Light discovery depth',
    color: 'text-outsail-blue',
  },
  growth: {
    label: 'Growth',
    range: '101–500 employees',
    depth: 'Standard discovery depth',
    color: 'text-outsail-purple',
  },
  enterprise: {
    label: 'Enterprise',
    range: '500+ employees',
    depth: 'Deep discovery depth',
    color: 'text-outsail-navy',
  },
}

export function NewProjectForm() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [scopeNotes, setScopeNotes] = useState('')
  const [tier, setTier] = useState<Tier | null>(null)
  const [suggestedTier, setSuggestedTier] = useState<Tier | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleHeadcountChange(value: string) {
    setHeadcount(value)
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0) {
      const suggested = suggestTier(num)
      setSuggestedTier(suggested)
      setTier(suggested)
    } else {
      setSuggestedTier(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!companyName.trim()) {
      setError('Company name is required.')
      return
    }
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError('A valid contact email is required.')
      return
    }
    if (!headcount || isNaN(parseInt(headcount, 10)) || parseInt(headcount, 10) < 1) {
      setError('Headcount must be a positive number.')
      return
    }
    if (!tier) {
      setError('Please select a tier.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          clientContactEmail: contactEmail.trim().toLowerCase(),
          headcount: parseInt(headcount, 10),
          tier,
          scopeNotes: scopeNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create project. Please try again.')
        return
      }

      router.push(`/dashboard/projects/${data.projectId}`)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const activeTier = tier ?? suggestedTier

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Company details */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <h2 className="text-header-sm text-outsail-navy">Company Details</h2>

          {/* Company name */}
          <div className="space-y-1.5">
            <label className="text-label text-outsail-gray-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Company Name <span className="text-outsail-coral">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Acme Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Contact email */}
          <div className="space-y-1.5">
            <label className="text-label text-outsail-gray-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Primary Contact Email <span className="text-outsail-coral">*</span>
            </label>
            <Input
              type="email"
              placeholder="hr@company.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={loading}
              required
            />
            <p className="text-xs text-outsail-gray-600">
              A magic link invitation will be sent to this address.
            </p>
          </div>

          {/* Headcount */}
          <div className="space-y-1.5">
            <label className="text-label text-outsail-gray-600 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Employee Headcount <span className="text-outsail-coral">*</span>
            </label>
            <Input
              type="number"
              placeholder="e.g. 250"
              min={1}
              value={headcount}
              onChange={(e) => handleHeadcountChange(e.target.value)}
              disabled={loading}
              required
              className="max-w-xs"
            />
          </div>

          {/* Scope notes */}
          <div className="space-y-1.5">
            <label className="text-label text-outsail-gray-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Scope Notes <span className="text-outsail-gray-600 font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="Any context about the project scope, priorities, or special considerations..."
              value={scopeNotes}
              onChange={(e) => setScopeNotes(e.target.value)}
              disabled={loading}
              rows={3}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-outsail-slate placeholder:text-outsail-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outsail-teal focus-visible:ring-offset-0 disabled:opacity-50 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tier selection */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-header-sm text-outsail-navy">Project Tier</h2>
            {suggestedTier && (
              <p className="text-xs text-outsail-gray-600 mt-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-outsail-amber" />
                Recommended <strong>{TIER_INFO[suggestedTier].label}</strong> based on {parseInt(headcount, 10).toLocaleString()} employees
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['essentials', 'growth', 'enterprise'] as Tier[]).map((t) => {
              const info = TIER_INFO[t]
              const isSelected = activeTier === t
              const isRecommended = suggestedTier === t

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  disabled={loading}
                  className={[
                    'relative rounded-card border-2 p-4 text-left transition-all',
                    isSelected
                      ? 'border-outsail-teal bg-outsail-teal-light'
                      : 'border-outsail-gray-200 bg-white hover:border-outsail-teal/50',
                    loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  {isRecommended && (
                    <span className="absolute -top-2.5 left-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-outsail-amber text-white">
                      Recommended
                    </span>
                  )}
                  <p className={`text-sm font-semibold mb-1 ${info.color}`}>
                    {info.label}
                  </p>
                  <p className="text-xs text-outsail-gray-600">{info.range}</p>
                  <p className="text-xs text-outsail-gray-600 mt-0.5">{info.depth}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <p className="text-sm text-outsail-coral flex items-center gap-1.5">
          <span className="font-medium">Error:</span> {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-6 rounded-md text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: loading ? '#1D9E75' : undefined, background: loading ? undefined : '#1D9E75' }}
          onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#0F6E56' }}
          onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1D9E75' }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Project…
            </>
          ) : (
            'Create Project & Send Invitation'
          )}
        </button>

        <a
          href="/dashboard"
          className="h-10 px-4 rounded-md text-sm font-medium text-outsail-gray-600 hover:text-outsail-navy border border-outsail-gray-200 hover:border-outsail-gray-600 transition-colors inline-flex items-center"
        >
          Cancel
        </a>
      </div>
    </form>
  )
}

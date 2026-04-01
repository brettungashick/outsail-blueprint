'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function NewProjectForm() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          clientContactEmail: contactEmail.trim().toLowerCase(),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <Card>
        <CardContent className="p-6 space-y-5">
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
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-outsail-coral">
          <span className="font-medium">Error:</span> {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-6 rounded-md text-sm font-semibold text-white bg-outsail-teal hover:bg-outsail-teal-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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

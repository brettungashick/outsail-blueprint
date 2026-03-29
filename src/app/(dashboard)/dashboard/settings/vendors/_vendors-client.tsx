'use client'

import { useState, useMemo } from 'react'

const ALL_CATEGORIES = [
  'Payroll', 'Benefits Admin', 'Time & Attendance', 'Onboarding',
  'Core HR', 'Performance', 'Compensation', 'Learning/LMS',
  'Recruiting/ATS', 'AI', 'Expense', 'SSO',
  'ERP/General Ledger', 'Global Payroll', 'Custom',
]

interface VendorRow {
  id: string
  product_name: string
  vendor_company: string | null
  website: string | null
  logo_url: string | null
  can_be_primary: boolean | null
  suggested_categories: string | null
  is_active: boolean | null
}

interface VendorsClientPageProps {
  initialVendors: VendorRow[]
}

export function VendorsClientPage({ initialVendors }: VendorsClientPageProps) {
  const [vendors, setVendors] = useState<VendorRow[]>(initialVendors)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [primaryFilter, setPrimaryFilter] = useState<'all' | 'primary' | 'point'>('all')
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [creatingTable, setCreatingTable] = useState(false)

  function parseCategories(raw: string | null): string[] {
    if (!raw) return []
    try { return JSON.parse(raw) as string[] } catch { return [] }
  }

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const cats = parseCategories(v.suggested_categories)
      const matchSearch =
        !search ||
        v.product_name.toLowerCase().includes(search.toLowerCase()) ||
        (v.vendor_company?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchCategory = !categoryFilter || cats.includes(categoryFilter)
      const matchPrimary =
        primaryFilter === 'all' ||
        (primaryFilter === 'primary' && v.can_be_primary) ||
        (primaryFilter === 'point' && !v.can_be_primary)
      return matchSearch && matchCategory && matchPrimary
    })
  }, [vendors, search, categoryFilter, primaryFilter])

  async function handleCreateTable() {
    setCreatingTable(true)
    try {
      const res = await fetch('/api/admin/create-vendors-table', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; message?: string; error?: string }
      if (data.ok) {
        setSeedResult(`✓ ${data.message ?? 'Table created'}`)
      } else {
        setSeedResult(`Error: ${data.error ?? 'Unknown error'}`)
      }
    } catch {
      setSeedResult('Failed to create table')
    } finally {
      setCreatingTable(false)
    }
  }

  async function handleSeedVendors() {
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await fetch('/api/admin/seed-vendors', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; inserted?: number; skipped?: number; total?: number; errors?: string[] }
      if (data.ok) {
        setSeedResult(`✓ Seeded ${data.inserted} vendors (${data.skipped} skipped, ${data.total} total)`)
        // Reload page to show updated vendors
        window.location.reload()
      } else {
        setSeedResult('Seed failed')
      }
    } catch {
      setSeedResult('Failed to seed vendors')
    } finally {
      setSeeding(false)
    }
  }

  async function toggleActive(id: string, currentValue: boolean | null) {
    const newValue = !currentValue
    setVendors((prev) => prev.map((v) => v.id === id ? { ...v, is_active: newValue } : v))
    try {
      await fetch(`/api/admin/vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newValue }),
      })
    } catch {
      // Revert
      setVendors((prev) => prev.map((v) => v.id === id ? { ...v, is_active: currentValue } : v))
    }
  }

  const activeCount = vendors.filter((v) => v.is_active !== false).length
  const primaryCount = vendors.filter((v) => v.can_be_primary).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-header-lg text-outsail-navy">Vendor Management</h1>
          <p className="text-body text-outsail-gray-600 mt-1">
            Manage the HR technology vendors available in the tech stack builder.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateTable}
            disabled={creatingTable}
            className="px-3 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-label hover:border-outsail-navy transition-colors disabled:opacity-40 text-sm"
          >
            {creatingTable ? 'Creating...' : 'Create Table'}
          </button>
          <button
            onClick={handleSeedVendors}
            disabled={seeding}
            className="px-4 py-2 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 transition-colors text-sm"
          >
            {seeding ? 'Seeding...' : 'Seed Vendors'}
          </button>
        </div>
      </div>

      {/* Seed result feedback */}
      {seedResult && (
        <div className={`p-3 rounded-card text-sm border ${seedResult.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {seedResult}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="outsail-card text-center">
          <p className="text-header-sm text-outsail-navy">{vendors.length}</p>
          <p className="text-label text-outsail-gray-600 mt-0.5">Total Vendors</p>
        </div>
        <div className="outsail-card text-center">
          <p className="text-header-sm text-outsail-navy">{activeCount}</p>
          <p className="text-label text-outsail-gray-600 mt-0.5">Active</p>
        </div>
        <div className="outsail-card text-center">
          <p className="text-header-sm text-outsail-navy">{primaryCount}</p>
          <p className="text-label text-outsail-gray-600 mt-0.5">Primary Platforms</p>
        </div>
      </div>

      {/* Filters */}
      <div className="outsail-card">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors text-sm"
          >
            <option value="">All Categories</option>
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="flex rounded-card border border-outsail-gray-200 overflow-hidden">
            {(['all', 'primary', 'point'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setPrimaryFilter(v)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  primaryFilter === v
                    ? 'bg-outsail-navy text-white'
                    : 'text-outsail-gray-600 hover:bg-outsail-gray-50'
                }`}
              >
                {v === 'all' ? 'All' : v === 'primary' ? 'Primary' : 'Point Solutions'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-outsail-gray-600 mt-2">{filtered.length} vendors shown</p>
      </div>

      {/* Vendors table */}
      {vendors.length === 0 ? (
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600 mb-4">No vendors yet.</p>
          <p className="text-sm text-outsail-gray-600">
            Click <strong>Create Table</strong> first, then <strong>Seed Vendors</strong> to populate from the seed file.
          </p>
        </div>
      ) : (
        <div className="outsail-card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-outsail-gray-50 border-b border-outsail-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Product</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Company</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Categories</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outsail-gray-200">
              {filtered.map((v) => {
                const cats = parseCategories(v.suggested_categories)
                return (
                  <tr key={v.id} className="hover:bg-outsail-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-outsail-navy">{v.product_name}</p>
                      {v.website && (
                        <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-xs text-outsail-teal hover:underline">
                          {v.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-outsail-slate">{v.vendor_company ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {cats.slice(0, 3).map((c) => (
                          <span key={c} className="text-xs bg-outsail-gray-50 border border-outsail-gray-200 px-1.5 py-0.5 rounded-full text-outsail-gray-600">
                            {c}
                          </span>
                        ))}
                        {cats.length > 3 && (
                          <span className="text-xs text-outsail-gray-600">+{cats.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                        v.can_be_primary
                          ? 'bg-outsail-teal/10 text-outsail-teal border-outsail-teal/30'
                          : 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'
                      }`}>
                        {v.can_be_primary ? 'Primary Platform' : 'Point Solution'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(v.id, v.is_active)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          v.is_active !== false ? 'bg-outsail-teal' : 'bg-outsail-gray-200'
                        }`}
                        aria-label={v.is_active !== false ? 'Deactivate' : 'Activate'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            v.is_active !== false ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useMemo, useRef } from 'react'

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
  primary_color: string | null
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      setSeedResult(data.ok ? `✓ ${data.message ?? 'Table created'}` : `Error: ${data.error ?? 'Unknown error'}`)
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
      const data = await res.json() as { ok?: boolean; inserted?: number; skipped?: number; total?: number }
      if (data.ok) {
        setSeedResult(`✓ Seeded ${data.inserted} vendors (${data.skipped} skipped, ${data.total} total)`)
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

  async function patch(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/vendors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    return res.ok
  }

  async function toggleActive(id: string, currentValue: boolean | null) {
    const newValue = !currentValue
    setVendors((prev) => prev.map((v) => v.id === id ? { ...v, is_active: newValue } : v))
    const ok = await patch(id, { is_active: newValue })
    if (!ok) setVendors((prev) => prev.map((v) => v.id === id ? { ...v, is_active: currentValue } : v))
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
            Manage HR technology vendors. Expand a row to upload a logo or set a brand color.
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

      {seedResult && (
        <div className={`p-3 rounded-card text-sm border ${seedResult.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {seedResult}
        </div>
      )}

      {/* Stats */}
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
                className={`px-3 py-2 text-sm font-medium transition-colors ${primaryFilter === v ? 'bg-outsail-navy text-white' : 'text-outsail-gray-600 hover:bg-outsail-gray-50'}`}
              >
                {v === 'all' ? 'All' : v === 'primary' ? 'Primary' : 'Point Solutions'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-outsail-gray-600 mt-2">{filtered.length} vendors shown</p>
      </div>

      {/* Table */}
      {vendors.length === 0 ? (
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600 mb-4">No vendors yet.</p>
          <p className="text-sm text-outsail-gray-600">Click <strong>Create Table</strong> first, then <strong>Seed Vendors</strong>.</p>
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
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Logo / Color</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outsail-gray-200">
              {filtered.map((v) => {
                const cats = parseCategories(v.suggested_categories)
                const isExpanded = expandedId === v.id
                return (
                  <VendorRow
                    key={v.id}
                    vendor={v}
                    cats={cats}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : v.id)}
                    onToggleActive={() => toggleActive(v.id, v.is_active)}
                    onPatch={(fields) => {
                      setVendors((prev) => prev.map((row) => row.id === v.id ? { ...row, ...fields } : row))
                      patch(v.id, fields)
                    }}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Vendor row with inline logo/color editing ──────────────────────────────────

function VendorRow({
  vendor,
  cats,
  isExpanded,
  onToggleExpand,
  onToggleActive,
  onPatch,
}: {
  vendor: VendorRow
  cats: string[]
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleActive: () => void
  onPatch: (fields: Record<string, unknown>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoInput, setLogoInput] = useState(vendor.logo_url ?? '')
  const [colorInput, setColorInput] = useState(vendor.primary_color ?? '#1D9E75')

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setLogoInput(dataUrl)
      onPatch({ logo_url: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  function handleLogoUrlSave() {
    onPatch({ logo_url: logoInput.trim() || null })
  }

  function handleColorChange(color: string) {
    setColorInput(color)
    onPatch({ primary_color: color })
  }

  return (
    <>
      <tr className="hover:bg-outsail-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {vendor.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo_url} alt="" className="w-6 h-6 object-contain rounded flex-shrink-0" />
            ) : (
              <div
                className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: vendor.primary_color ?? '#6B6B65' }}
              >
                {vendor.product_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-outsail-navy">{vendor.product_name}</p>
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-xs text-outsail-teal hover:underline">
                  {vendor.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-outsail-slate">{vendor.vendor_company ?? '—'}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {cats.slice(0, 3).map((c) => (
              <span key={c} className="text-xs bg-outsail-gray-50 border border-outsail-gray-200 px-1.5 py-0.5 rounded-full text-outsail-gray-600">{c}</span>
            ))}
            {cats.length > 3 && <span className="text-xs text-outsail-gray-600">+{cats.length - 3}</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${vendor.can_be_primary ? 'bg-outsail-teal/10 text-outsail-teal border-outsail-teal/30' : 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'}`}>
            {vendor.can_be_primary ? 'Primary Platform' : 'Point Solution'}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 text-xs text-outsail-teal hover:underline"
          >
            {vendor.logo_url ? '✓ Logo' : 'Add logo'}
            {vendor.primary_color ? ` · ${vendor.primary_color}` : ''}
            <span className="text-outsail-gray-200">·</span>
            <span>{isExpanded ? 'close ▲' : 'edit ▼'}</span>
          </button>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={onToggleActive}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${vendor.is_active !== false ? 'bg-outsail-teal' : 'bg-outsail-gray-200'}`}
            aria-label={vendor.is_active !== false ? 'Deactivate' : 'Activate'}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${vendor.is_active !== false ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-outsail-gray-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="flex flex-wrap gap-6 items-start">
              {/* Logo section */}
              <div className="space-y-2 min-w-[280px]">
                <p className="text-label text-outsail-navy">Logo (URL or upload PNG/SVG)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={logoInput}
                    onChange={(e) => setLogoInput(e.target.value)}
                    placeholder="https://... or upload file →"
                    className="flex-1 px-3 py-1.5 border border-outsail-gray-200 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
                  />
                  <button
                    onClick={handleLogoUrlSave}
                    className="px-3 py-1.5 bg-outsail-teal text-white text-sm rounded-card hover:bg-outsail-teal/90"
                  >Save</button>
                </div>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoFile} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 border border-outsail-gray-200 text-sm text-outsail-gray-600 rounded-card hover:border-outsail-navy"
                  >Upload file</button>
                  {vendor.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vendor.logo_url} alt="" className="h-8 w-auto object-contain border border-outsail-gray-200 rounded p-0.5" />
                  )}
                </div>
              </div>

              {/* Color section */}
              <div className="space-y-2">
                <p className="text-label text-outsail-navy">Brand Color</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorInput}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-outsail-gray-200"
                  />
                  <span className="text-sm font-mono text-outsail-slate">{colorInput}</span>
                  <div className="w-8 h-8 rounded-full border-2" style={{ borderColor: colorInput, backgroundColor: colorInput + '20' }} />
                </div>
                <p className="text-xs text-outsail-gray-600">Used as tint on the tech stack canvas circle border</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

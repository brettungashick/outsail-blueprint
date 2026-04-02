'use client'

import { useState, useMemo, useRef, useCallback } from 'react'

const ALL_CATEGORIES = [
  'Primary Vendor',
  'Payroll',
  'Benefits Admin',
  'Time & Attendance',
  'Onboarding',
  'Core HR / Employee Files',
  'Performance',
  'Compensation',
  'Learning / LMS',
  'Recruiting / ATS',
  'Engagement',
  'SSO',
  'ERP / General Ledger',
  'Global Payroll',
  'Expense',
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

function parseCategories(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

interface VendorsClientPageProps {
  initialVendors: VendorRow[]
}

// ── Edit / Add Modal ──────────────────────────────────────────────────────────

interface EditModalProps {
  vendor: Partial<VendorRow> | null  // null = new vendor
  onClose: () => void
  onSaved: (vendor: VendorRow) => void
}

function EditModal({ vendor, onClose, onSaved }: EditModalProps) {
  const isNew = !vendor?.id
  const fileRef = useRef<HTMLInputElement>(null)

  const [productName, setProductName] = useState(vendor?.product_name ?? '')
  const [vendorCompany, setVendorCompany] = useState(vendor?.vendor_company ?? '')
  const [website, setWebsite] = useState(vendor?.website ?? '')
  const [logoUrl, setLogoUrl] = useState(vendor?.logo_url ?? '')
  const [color, setColor] = useState(vendor?.primary_color ?? '#1D9E75')
  const [categories, setCategories] = useState<string[]>(parseCategories(vendor?.suggested_categories ?? null))
  const [canBePrimary, setCanBePrimary] = useState(vendor?.can_be_primary ?? false)
  const [isActive, setIsActive] = useState(vendor?.is_active !== false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!productName.trim()) { setError('Product name is required'); return }
    setSaving(true)
    setError(null)

    const payload = {
      product_name: productName.trim(),
      vendor_company: vendorCompany.trim() || null,
      website: website.trim() || null,
      logo_url: logoUrl.trim() || null,
      primary_color: color || null,
      suggested_categories: categories,
      can_be_primary: canBePrimary,
      is_active: isActive,
    }

    try {
      let res: Response
      if (isNew) {
        res = await fetch('/api/admin/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/admin/vendors/${vendor!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json() as { ok?: boolean; id?: string; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Save failed')
        return
      }

      const saved: VendorRow = {
        id: isNew ? (data.id ?? '') : vendor!.id!,
        product_name: payload.product_name,
        vendor_company: payload.vendor_company,
        website: payload.website,
        logo_url: payload.logo_url,
        primary_color: payload.primary_color,
        can_be_primary: payload.can_be_primary,
        suggested_categories: JSON.stringify(payload.suggested_categories),
        is_active: payload.is_active,
      }
      onSaved(saved)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outsail-gray-200">
          <h2 className="text-lg font-semibold text-outsail-navy">
            {isNew ? 'Add New Vendor' : `Edit: ${vendor?.product_name}`}
          </h2>
          <button onClick={onClose} className="text-outsail-gray-600 hover:text-outsail-navy text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Names */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label text-outsail-navy mb-1">Product Name <span className="text-outsail-coral">*</span></label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
                placeholder="e.g. Workday HCM"
              />
            </div>
            <div>
              <label className="block text-label text-outsail-navy mb-1">Vendor Company</label>
              <input
                type="text"
                value={vendorCompany}
                onChange={(e) => setVendorCompany(e.target.value)}
                className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
                placeholder="e.g. Workday"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-label text-outsail-navy mb-1">Website</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
              placeholder="https://..."
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-label text-outsail-navy mb-2">Logo</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-12 h-12 object-contain border border-outsail-gray-200 rounded-lg p-1 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg border border-dashed border-outsail-gray-200 flex items-center justify-center text-outsail-gray-600 flex-shrink-0 text-xs">Logo</div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-sm focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal"
                  placeholder="https://... or upload below"
                />
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoFile} />
                  <button onClick={() => fileRef.current?.click()} type="button"
                    className="px-3 py-1.5 border border-outsail-gray-200 text-sm text-outsail-gray-600 rounded-card hover:border-outsail-navy transition-colors">
                    Upload PNG / SVG
                  </button>
                  {logoUrl && (
                    <button onClick={() => setLogoUrl('')} type="button"
                      className="text-xs text-outsail-coral hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Brand color */}
          <div>
            <label className="block text-label text-outsail-navy mb-2">Brand / Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-outsail-gray-200"
              />
              <span className="text-sm font-mono text-outsail-slate">{color}</span>
              <div className="w-8 h-8 rounded-full border-2" style={{ borderColor: color, backgroundColor: color + '25' }} />
              <p className="text-xs text-outsail-gray-600">Used as circle border on the tech stack canvas</p>
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-label text-outsail-navy mb-2">Categories <span className="text-outsail-gray-600 font-normal">(select all that apply)</span></label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_CATEGORIES.map((cat) => (
                <label key={cat} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${categories.includes(cat) ? 'bg-outsail-teal/10 border-outsail-teal text-outsail-teal font-medium' : 'border-outsail-gray-200 text-outsail-slate hover:border-outsail-teal/50'}`}>
                  <input
                    type="checkbox"
                    checked={categories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                    className="sr-only"
                  />
                  <span className={`w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center ${categories.includes(cat) ? 'bg-outsail-teal border-outsail-teal' : 'border-outsail-gray-200'}`}>
                    {categories.includes(cat) && <span className="text-white text-[8px] leading-none">✓</span>}
                  </span>
                  {cat}
                </label>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={canBePrimary} onChange={(e) => setCanBePrimary(e.target.checked)}
                className="w-4 h-4 rounded border-outsail-gray-200 text-outsail-teal focus:ring-outsail-teal/30" />
              <span className="text-sm text-outsail-slate">Can be primary HCM platform</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-outsail-gray-200 text-outsail-teal focus:ring-outsail-teal/30" />
              <span className="text-sm text-outsail-slate">Active (visible to clients)</span>
            </label>
          </div>

          {error && <p className="text-sm text-outsail-coral">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outsail-gray-200 bg-outsail-gray-50">
          <button onClick={onClose} type="button"
            className="px-4 py-2 border border-outsail-gray-200 text-sm text-outsail-gray-600 rounded-card hover:border-outsail-navy transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} type="button"
            className="px-4 py-2 bg-outsail-teal text-white text-sm font-medium rounded-card hover:bg-outsail-teal/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : isNew ? 'Add Vendor' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function VendorsClientPage({ initialVendors }: VendorsClientPageProps) {
  const [vendors, setVendors] = useState<VendorRow[]>(initialVendors)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [primaryFilter, setPrimaryFilter] = useState<'all' | 'primary' | 'point'>('all')
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [editingVendor, setEditingVendor] = useState<Partial<VendorRow> | null | undefined>(undefined)
  // undefined = modal closed, null = add new, VendorRow = editing existing

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const cats = parseCategories(v.suggested_categories)
      const matchSearch =
        !search ||
        v.product_name.toLowerCase().includes(search.toLowerCase()) ||
        (v.vendor_company?.toLowerCase().includes(search.toLowerCase()) ?? false)
      const matchCategory = !categoryFilter || cats.some((c) =>
        c.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        categoryFilter.toLowerCase().includes(c.toLowerCase())
      )
      const matchPrimary =
        primaryFilter === 'all' ||
        (primaryFilter === 'primary' && v.can_be_primary) ||
        (primaryFilter === 'point' && !v.can_be_primary)
      return matchSearch && matchCategory && matchPrimary
    })
  }, [vendors, search, categoryFilter, primaryFilter])

  const handleSaved = useCallback((saved: VendorRow) => {
    setVendors((prev) => {
      const idx = prev.findIndex((v) => v.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
    setEditingVendor(undefined)
  }, [])

  async function handleSeedVendors() {
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await fetch('/api/admin/seed-vendors', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; inserted?: number; skipped?: number; total?: number }
      if (data.ok) {
        setSeedResult(`✓ Seeded ${data.inserted} new vendors, updated ${data.skipped} existing`)
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

  async function toggleActive(id: string, current: boolean | null) {
    const newValue = !current
    setVendors((prev) => prev.map((v) => v.id === id ? { ...v, is_active: newValue } : v))
    const res = await fetch(`/api/admin/vendors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newValue }),
    })
    if (!res.ok) setVendors((prev) => prev.map((v) => v.id === id ? { ...v, is_active: current } : v))
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
            Manage the HR technology vendors available to clients.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeedVendors}
            disabled={seeding}
            className="px-3 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-sm hover:border-outsail-navy transition-colors disabled:opacity-40"
          >
            {seeding ? 'Seeding…' : 'Re-seed Vendors'}
          </button>
          <button
            onClick={() => setEditingVendor(null)}
            className="px-4 py-2 bg-outsail-teal text-white rounded-card text-sm font-medium hover:bg-outsail-teal/90 transition-colors"
          >
            + Add New Vendor
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
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border border-outsail-gray-200 rounded-card text-sm text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-outsail-gray-200 rounded-card text-sm text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
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
        <p className="text-xs text-outsail-gray-600 mt-2">{filtered.length} of {vendors.length} vendors shown</p>
      </div>

      {/* Table */}
      {vendors.length === 0 ? (
        <div className="outsail-card text-center py-12">
          <p className="text-body text-outsail-gray-600 mb-4">No vendors yet.</p>
          <p className="text-sm text-outsail-gray-600">Click <strong>Re-seed Vendors</strong> to load the vendor database.</p>
        </div>
      ) : (
        <div className="outsail-card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-outsail-gray-50 border-b border-outsail-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Vendor</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Company</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Categories</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Branding</th>
                <th className="text-left px-4 py-3 text-label text-outsail-gray-600">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outsail-gray-200">
              {filtered.map((v) => {
                const cats = parseCategories(v.suggested_categories)
                return (
                  <tr key={v.id} className="hover:bg-outsail-gray-50 transition-colors">
                    {/* Vendor name + logo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {v.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.logo_url} alt="" className="w-7 h-7 object-contain rounded flex-shrink-0 border border-outsail-gray-200 p-0.5" />
                        ) : (
                          <div
                            className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: v.primary_color ?? '#6B6B65' }}
                          >
                            {v.product_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-outsail-navy">{v.product_name}</p>
                          {v.can_be_primary && (
                            <span className="text-[10px] font-medium text-outsail-teal">Primary Platform</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Company */}
                    <td className="px-4 py-3 text-sm text-outsail-slate">{v.vendor_company ?? '—'}</td>
                    {/* Categories */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {cats.slice(0, 3).map((c) => (
                          <span key={c} className="text-[10px] bg-outsail-gray-50 border border-outsail-gray-200 px-1.5 py-0.5 rounded-full text-outsail-gray-600 whitespace-nowrap">{c}</span>
                        ))}
                        {cats.length > 3 && (
                          <span className="text-[10px] text-outsail-gray-600">+{cats.length - 3}</span>
                        )}
                      </div>
                    </td>
                    {/* Branding: color swatch */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {v.primary_color && (
                          <div
                            className="w-5 h-5 rounded border border-outsail-gray-200 flex-shrink-0"
                            style={{ backgroundColor: v.primary_color }}
                            title={v.primary_color}
                          />
                        )}
                        <span className="text-xs font-mono text-outsail-gray-600">
                          {v.primary_color ?? '—'}
                        </span>
                      </div>
                    </td>
                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(v.id, v.is_active)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${v.is_active !== false ? 'bg-outsail-teal' : 'bg-outsail-gray-200'}`}
                        aria-label={v.is_active !== false ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${v.is_active !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </td>
                    {/* Edit button */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditingVendor(v)}
                        className="text-xs text-outsail-teal hover:underline font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingVendor !== undefined && (
        <EditModal
          vendor={editingVendor}
          onClose={() => setEditingVendor(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface VendorResult {
  id: string
  product_name: string
  vendor_company: string | null
  logo_url: string | null
  primary_color: string | null
  can_be_primary: boolean | null
}

// ── Hardcoded fallback — shown immediately on open, replaced by DB results ────
// Used when the DB hasn't seeded yet or the request times out.

const FALLBACK_PRIMARY: VendorResult[] = [
  { id: 'fb-workday',      product_name: 'Workday HCM',          vendor_company: 'Workday',     logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-adp',          product_name: 'ADP Workforce Now',     vendor_company: 'ADP',         logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-sap',          product_name: 'SAP SuccessFactors',    vendor_company: 'SAP',         logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-ukg-pro',      product_name: 'UKG Pro',               vendor_company: 'UKG',         logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-ceridian',     product_name: 'Ceridian Dayforce',     vendor_company: 'Ceridian',    logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-oracle',       product_name: 'Oracle HCM Cloud',      vendor_company: 'Oracle',      logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-paycom',       product_name: 'Paycom',                vendor_company: 'Paycom',      logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-paylocity',    product_name: 'Paylocity',             vendor_company: 'Paylocity',   logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-bamboohr',     product_name: 'BambooHR',              vendor_company: 'BambooHR',    logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-paychex',      product_name: 'Paychex Flex',          vendor_company: 'Paychex',     logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-rippling',     product_name: 'Rippling',              vendor_company: 'Rippling',    logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-gusto',        product_name: 'Gusto',                 vendor_company: 'Gusto',       logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-paycor',       product_name: 'Paycor',                vendor_company: 'Paycor',      logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-isolved',      product_name: 'isolved',               vendor_company: 'isolved',     logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-cornerstone',  product_name: 'Cornerstone OnDemand',  vendor_company: 'Cornerstone', logo_url: null, primary_color: null, can_be_primary: true },
  { id: 'fb-infor',        product_name: 'Infor HCM',             vendor_company: 'Infor',       logo_url: null, primary_color: null, can_be_primary: true },
]

const FALLBACK_ALL: VendorResult[] = [
  ...FALLBACK_PRIMARY,
  { id: 'fb-greenhouse',   product_name: 'Greenhouse',            vendor_company: 'Greenhouse',  logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-lever',        product_name: 'Lever',                 vendor_company: 'Lever',       logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-icims',        product_name: 'iCIMS',                 vendor_company: 'iCIMS',       logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-lattice',      product_name: 'Lattice',               vendor_company: 'Lattice',     logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-15five',       product_name: '15Five',                vendor_company: '15Five',      logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-docebo',       product_name: 'Docebo',                vendor_company: 'Docebo',      logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-benefitfocus', product_name: 'Benefitfocus',          vendor_company: 'Benefitfocus',logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-kronos',       product_name: 'UKG Workforce Central', vendor_company: 'UKG',         logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-replicon',     product_name: 'Replicon',              vendor_company: 'Replicon',    logo_url: null, primary_color: null, can_be_primary: false },
  { id: 'fb-deputy',       product_name: 'Deputy',                vendor_company: 'Deputy',      logo_url: null, primary_color: null, can_be_primary: false },
]

function getFallback(canBePrimary?: boolean, category?: string): VendorResult[] {
  let list = canBePrimary ? FALLBACK_PRIMARY : FALLBACK_ALL
  if (category) {
    // Light category filter on fallback — just show everything since we don't have category data
    // (DB results will replace these with proper filtering)
  }
  return list
}

// ─────────────────────────────────────────────────────────────────────────────

interface VendorComboboxProps {
  value: string
  onChange: (v: string) => void
  /** Called with the full vendor record when a known vendor is selected, null for custom entries */
  onSelectFull?: (vendor: VendorResult | null) => void
  placeholder?: string
  /** Only show vendors that can be a primary HCM platform */
  canBePrimary?: boolean
  /** Filter vendors by suggested category */
  category?: string
}

export function VendorCombobox({
  value,
  onChange,
  onSelectFull,
  placeholder = 'Search vendors...',
  canBePrimary,
  category,
}: VendorComboboxProps) {
  const [inputValue, setInputValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [vendors, setVendors] = useState<VendorResult[]>(() => getFallback(canBePrimary, category))
  const [loading, setLoading] = useState(false)
  const dbLoadedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Sync input when value prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchVendors = useCallback(
    async (query: string) => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Only show spinner on typing, not on initial load (fallback is shown instead)
      if (query) setLoading(true)

      // 5-second timeout so we never hang forever
      const timeout = setTimeout(() => controller.abort(), 5000)

      try {
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        if (canBePrimary !== undefined) params.set('can_be_primary', String(canBePrimary))
        if (category) params.set('category', category)

        const res = await fetch(`/api/vendors?${params.toString()}`, {
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { vendors: VendorResult[] }
        const dbVendors = data.vendors ?? []

        if (dbVendors.length > 0) {
          setVendors(dbVendors)
          dbLoadedRef.current = true
        } else if (!dbLoadedRef.current) {
          // DB returned empty — keep showing fallback
          setVendors(getFallback(canBePrimary, category))
        }
      } catch (err) {
        clearTimeout(timeout)
        // AbortError = timeout or cancelled — keep current list
        if (err instanceof Error && err.name === 'AbortError') return
        // Other errors — fall back to hardcoded list
        if (!dbLoadedRef.current) {
          setVendors(getFallback(canBePrimary, category))
        }
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canBePrimary, category]
  )

  // Load DB vendors on mount (non-blocking — fallback is shown in the meantime)
  useEffect(() => {
    void fetchVendors('')
  }, [fetchVendors])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInputValue(v)
    setOpen(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchVendors(v)
    }, 200)
  }

  function handleSelect(productName: string, vendorRecord?: VendorResult) {
    setInputValue(productName)
    onChange(productName)
    if (onSelectFull) onSelectFull(vendorRecord ?? null)
    setOpen(false)
  }

  // Client-side filter of current list when user types (instant, before DB responds)
  const q = inputValue.trim().toLowerCase()
  const displayVendors = q
    ? vendors.filter(
        (v) =>
          v.product_name.toLowerCase().includes(q) ||
          (v.vendor_company?.toLowerCase().includes(q) ?? false)
      )
    : vendors

  const showCustomEntry =
    inputValue.trim().length > 0 &&
    !displayVendors.some((v) => v.product_name.toLowerCase() === inputValue.toLowerCase())

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
      />

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-outsail-gray-200 rounded-card shadow-lg max-h-[300px] overflow-y-auto" style={{ width: 'max(100%, 480px)' }}>
          {loading && displayVendors.length === 0 && (
            <div className="px-3 py-2 text-sm text-outsail-gray-600">Loading...</div>
          )}

          {!loading && displayVendors.length === 0 && !showCustomEntry && (
            <div className="px-3 py-2 text-sm text-outsail-gray-600">No vendors found</div>
          )}

          {displayVendors.map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(vendor.product_name, vendor)
              }}
              className={`w-full text-left px-3 py-2.5 hover:bg-outsail-gray-50 transition-colors flex items-center gap-3 ${
                vendor.product_name === value ? 'text-outsail-teal font-medium' : 'text-outsail-slate'
              }`}
            >
              {vendor.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.logo_url} alt="" className="w-6 h-6 object-contain flex-shrink-0 rounded" />
              ) : (
                <div className="w-6 h-6 rounded flex-shrink-0 bg-outsail-gray-50 border border-outsail-gray-200 flex items-center justify-center text-[8px] font-bold text-outsail-gray-600">
                  {vendor.product_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm flex-1 truncate">{vendor.product_name}</span>
              {vendor.vendor_company && vendor.vendor_company !== vendor.product_name && (
                <span className="text-xs text-outsail-gray-600 flex-shrink-0">{vendor.vendor_company}</span>
              )}
            </button>
          ))}

          {showCustomEntry && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(inputValue.trim())
              }}
              className="w-full text-left px-3 py-2 text-body text-outsail-teal border-t border-outsail-gray-200 hover:bg-outsail-gray-50 transition-colors italic"
            >
              Use &ldquo;{inputValue.trim()}&rdquo; as custom entry
            </button>
          )}
        </div>
      )}
    </div>
  )
}

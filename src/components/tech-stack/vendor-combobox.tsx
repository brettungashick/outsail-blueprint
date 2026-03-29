'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface VendorResult {
  id: string
  product_name: string
  vendor_company: string | null
  logo_url: string | null
  can_be_primary: boolean | null
}

interface VendorComboboxProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Only show vendors that can be a primary HCM platform */
  canBePrimary?: boolean
  /** Filter vendors by suggested category */
  category?: string
}

export function VendorCombobox({
  value,
  onChange,
  placeholder = 'Search vendors...',
  canBePrimary,
  category,
}: VendorComboboxProps) {
  const [inputValue, setInputValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [vendors, setVendors] = useState<VendorResult[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        if (canBePrimary !== undefined) params.set('can_be_primary', String(canBePrimary))
        if (category) params.set('category', category)

        const res = await fetch(`/api/vendors?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = (await res.json()) as { vendors: VendorResult[] }
        setVendors(data.vendors ?? [])
      } catch {
        setVendors([])
      } finally {
        setLoading(false)
      }
    },
    [canBePrimary, category]
  )

  // Load initial vendors on mount
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

  function handleSelect(productName: string) {
    setInputValue(productName)
    onChange(productName)
    setOpen(false)
  }

  const showCustomEntry =
    inputValue.trim().length > 0 &&
    !vendors.some((v) => v.product_name.toLowerCase() === inputValue.toLowerCase())

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
        <div className="absolute z-50 w-full mt-1 bg-white border border-outsail-gray-200 rounded-card shadow-md max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-outsail-gray-600">Loading...</div>
          )}

          {!loading && vendors.length === 0 && !showCustomEntry && (
            <div className="px-3 py-2 text-sm text-outsail-gray-600">No vendors found</div>
          )}

          {!loading && vendors.map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(vendor.product_name)
              }}
              className={`w-full text-left px-3 py-2 text-body hover:bg-outsail-gray-50 transition-colors flex items-center gap-2 ${
                vendor.product_name === value ? 'text-outsail-teal font-medium' : 'text-outsail-slate'
              }`}
            >
              {vendor.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vendor.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
              )}
              <span className="truncate">{vendor.product_name}</span>
              {vendor.vendor_company && vendor.vendor_company !== vendor.product_name && (
                <span className="text-xs text-outsail-gray-600 ml-auto flex-shrink-0">{vendor.vendor_company}</span>
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

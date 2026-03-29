'use client'

import { useState, useRef, useEffect } from 'react'
import { HRIS_VENDORS } from '@/lib/tech-stack/vendors'

interface VendorComboboxProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function VendorCombobox({ value, onChange, placeholder = 'Search vendors...' }: VendorComboboxProps) {
  const [inputValue, setInputValue] = useState(value)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const filtered = HRIS_VENDORS.filter((v) =>
    v.toLowerCase().includes(inputValue.toLowerCase())
  )

  const showCustomEntry =
    inputValue.trim().length > 0 &&
    !HRIS_VENDORS.some((v) => v.toLowerCase() === inputValue.toLowerCase())

  function handleSelect(vendor: string) {
    setInputValue(vendor)
    onChange(vendor)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-body text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal transition-colors"
      />

      {open && (filtered.length > 0 || showCustomEntry) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-outsail-gray-200 rounded-card shadow-md max-h-60 overflow-y-auto">
          {filtered.map((vendor) => (
            <button
              key={vendor}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(vendor)
              }}
              className={`w-full text-left px-3 py-2 text-body hover:bg-outsail-gray-50 transition-colors ${
                vendor === value ? 'text-outsail-teal font-medium' : 'text-outsail-slate'
              }`}
            >
              {vendor}
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

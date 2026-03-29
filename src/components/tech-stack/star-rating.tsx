'use client'

import { useState } from 'react'

interface StarRatingProps {
  value: number
  onChange: (v: number) => void
  label: string
  readOnly?: boolean
}

export function StarRating({ value, onChange, label, readOnly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const displayValue = hovered ?? value

  return (
    <div className="flex items-center gap-3">
      <span className="text-label text-outsail-gray-600 min-w-0 flex-1">{label}</span>
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => !readOnly && setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            className={`text-2xl leading-none transition-colors focus:outline-none ${
              readOnly ? 'cursor-default' : 'cursor-pointer'
            }`}
            aria-label={`${star} star`}
          >
            <span
              style={{
                color: star <= displayValue ? '#E5A000' : '#D3D1C7',
              }}
            >
              ★
            </span>
          </button>
        ))}
        <span className="ml-1.5 text-label text-outsail-gray-600 tabular-nums">
          {value > 0 ? `${value}/5` : '—'}
        </span>
      </div>
    </div>
  )
}

'use client'

import { useRef, useCallback } from 'react'
import { HCM_CAPABILITIES } from '@/lib/tech-stack/vendors'
import type { TechStackSystemRow, IntegrationRow } from './tech-stack-builder'

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
interface TechStackVizProps {
  systems: TechStackSystemRow[]
  integrations: IntegrationRow[]
  onSystemClick?: (systemId: string) => void
}

// ----------------------------------------------------------------
// Integration quality colors
// ----------------------------------------------------------------
const QUALITY_COLORS: Record<string, string> = {
  fully_integrated: '#1D9E75',
  mostly_automated: '#E5A000',
  partially_automated: '#D85A30',
  fully_manual: '#9CA3AF',
}

const QUALITY_LABELS: Record<string, string> = {
  fully_integrated: 'Fully Integrated',
  mostly_automated: 'Mostly Automated',
  partially_automated: 'Partially Automated',
  fully_manual: 'Fully Manual',
}

const QUALITY_ICONS: Record<string, string> = {
  fully_integrated: '✅',
  mostly_automated: '🔄',
  partially_automated: '⚡',
  fully_manual: '📋',
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function avgRating(systems: TechStackSystemRow[], system?: TechStackSystemRow): number {
  if (!system) return 0
  if (system.experience_rating != null) return system.experience_rating
  const { admin, employee, service } = system.ratings
  return Math.round((admin + employee + service) / 3)
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ----------------------------------------------------------------
// TechStackViz
// ----------------------------------------------------------------
export function TechStackViz({ systems, integrations, onSystemClick }: TechStackVizProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const primary = systems.find((s) => s.is_primary)
  const satellites = systems.filter((s) => !s.is_primary).slice(0, 7)

  // Compute gap capabilities (not covered by any system)
  const allModules = systems.flatMap((s) => s.modules_used)
  const gapCaps = HCM_CAPABILITIES
    .filter((cap) => !allModules.includes(cap) && !(primary?.modules_used ?? []).includes(cap))
    .slice(0, 4)

  // All orbit items: satellites first, then gaps
  const orbitItems: Array<
    | { kind: 'satellite'; system: TechStackSystemRow }
    | { kind: 'gap'; cap: string }
  > = [
    ...satellites.map((s) => ({ kind: 'satellite' as const, system: s })),
    ...gapCaps.map((cap) => ({ kind: 'gap' as const, cap })),
  ]

  const totalOrbit = Math.min(orbitItems.length, 8)
  const cx = 450
  const cy = 280
  const orbitRadius = 280
  const primaryR = 130
  const satelliteR = 80
  const gapR = 70

  // Compute integration quality for a satellite
  function qualityFor(system: TechStackSystemRow): string | null {
    if (!system.id) return null
    const integ = integrations.find(
      (i) => i.source_id === system.id || i.target_id === system.id
    )
    return integ?.quality ?? null
  }

  // ----------------------------------------------------------------
  // Download PNG
  // ----------------------------------------------------------------
  const downloadPng = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 900
      canvas.height = 620
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#F8F7F4'
      ctx.fillRect(0, 0, 900, 620)
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = 'tech-stack.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }, [])

  const primaryAvg = primary ? avgRating(systems, primary) : 0

  return (
    <div className="space-y-4">
      {/* Download button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={downloadPng}
          className="px-4 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-label hover:border-outsail-teal hover:text-outsail-teal transition-colors flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PNG
        </button>
      </div>

      {/* SVG Diagram */}
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          width={900}
          height={560}
          viewBox="0 0 900 560"
          className="w-full max-w-full"
          style={{ background: '#F8F7F4', borderRadius: 12 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Define clip path for SVG */}
          <defs>
            <clipPath id="primaryClip">
              <circle cx={cx} cy={cy} r={primaryR - 4} />
            </clipPath>
          </defs>

          {/* Connecting lines */}
          {orbitItems.slice(0, totalOrbit).map((item, i) => {
            const angle = (2 * Math.PI / totalOrbit) * i - Math.PI / 2
            const sx = cx + orbitRadius * Math.cos(angle)
            const sy = cy + orbitRadius * Math.sin(angle)

            let strokeColor = '#9CA3AF'
            if (item.kind === 'satellite') {
              const q = qualityFor(item.system)
              if (q) strokeColor = QUALITY_COLORS[q] ?? '#9CA3AF'
            } else {
              strokeColor = '#D85A30' // gap = coral (unconnected)
            }

            return (
              <line
                key={`line-${i}`}
                x1={cx}
                y1={cy}
                x2={sx}
                y2={sy}
                stroke={strokeColor}
                strokeWidth={item.kind === 'gap' ? 1.5 : 2}
                strokeDasharray={item.kind === 'gap' ? '5,4' : undefined}
                opacity={0.7}
              />
            )
          })}

          {/* Primary vendor circle */}
          {primary ? (
            <g
              onClick={() => primary.id && onSystemClick?.(primary.id)}
              style={{ cursor: onSystemClick ? 'pointer' : 'default' }}
            >
              <circle cx={cx} cy={cy} r={primaryR} fill="white" stroke="#1B3A5C" strokeWidth={3} />
              {/* Vendor name */}
              <text
                x={cx}
                y={cy - 18}
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                fontSize={16}
                fontWeight={700}
                fill="#1B3A5C"
              >
                {truncate(primary.vendor ?? primary.system_name, 18)}
              </text>
              {/* Star rating */}
              <text
                x={cx}
                y={cy + 8}
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                fontSize={13}
                fill="#1D9E75"
              >
                ★ {primaryAvg.toFixed(1)}
              </text>
              {/* Module pills — up to 4 */}
              {primary.modules_used.slice(0, 4).map((mod, mi) => {
                const pillW = Math.min(mod.length * 6.5 + 10, 100)
                const totalPills = Math.min(primary.modules_used.length, 4)
                const spacing = 8
                const totalWidth = totalPills * pillW + (totalPills - 1) * spacing
                const startX = cx - totalWidth / 2 + mi * (pillW + spacing) + pillW / 2
                return (
                  <g key={mod}>
                    <rect
                      x={startX - pillW / 2}
                      y={cy + 20}
                      width={pillW}
                      height={16}
                      rx={8}
                      fill="#F3F4F6"
                      stroke="#D3D1C7"
                      strokeWidth={1}
                    />
                    <text
                      x={startX}
                      y={cy + 31}
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize={9}
                      fill="#6B7280"
                    >
                      {truncate(mod, 12)}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : (
            /* Empty primary placeholder */
            <g>
              <circle cx={cx} cy={cy} r={primaryR} fill="#F8F7F4" stroke="#D3D1C7" strokeWidth={2} strokeDasharray="6,4" />
              <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={13} fill="#9CA3AF">No primary</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={13} fill="#9CA3AF">system set</text>
            </g>
          )}

          {/* Orbit items */}
          {orbitItems.slice(0, totalOrbit).map((item, i) => {
            const angle = (2 * Math.PI / totalOrbit) * i - Math.PI / 2
            const sx = cx + orbitRadius * Math.cos(angle)
            const sy = cy + orbitRadius * Math.sin(angle)

            if (item.kind === 'satellite') {
              const sys = item.system
              const satAvg = avgRating(systems, sys)
              const r = satelliteR
              return (
                <g
                  key={`sat-${i}`}
                  onClick={() => sys.id && onSystemClick?.(sys.id)}
                  style={{ cursor: onSystemClick ? 'pointer' : 'default' }}
                >
                  <circle cx={sx} cy={sy} r={r} fill="white" stroke="#1D9E75" strokeWidth={2} />
                  <text
                    x={sx}
                    y={sy - 10}
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    fontSize={11}
                    fontWeight={700}
                    fill="#1B3A5C"
                  >
                    {truncate(sys.vendor ?? sys.system_name, 14)}
                  </text>
                  <text
                    x={sx}
                    y={sy + 8}
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    fontSize={11}
                    fill="#1D9E75"
                  >
                    ★ {satAvg.toFixed(1)}
                  </text>
                  {sys.system_type && (
                    <text
                      x={sx}
                      y={sy + 24}
                      textAnchor="middle"
                      fontFamily="Inter, sans-serif"
                      fontSize={9}
                      fill="#9CA3AF"
                    >
                      {sys.system_type.replace(/_/g, ' ')}
                    </text>
                  )}
                </g>
              )
            } else {
              // Gap circle
              const r = gapR
              return (
                <g key={`gap-${i}`}>
                  <circle cx={sx} cy={sy} r={r} fill="#FFF5F3" stroke="#D85A30" strokeWidth={1.5} strokeDasharray="5,3" />
                  <text
                    x={sx}
                    y={sy - 8}
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    fontSize={9}
                    fontWeight={700}
                    fill="#D85A30"
                    letterSpacing={1}
                  >
                    NO SYSTEM
                  </text>
                  <text
                    x={sx}
                    y={sy + 8}
                    textAnchor="middle"
                    fontFamily="Inter, sans-serif"
                    fontSize={10}
                    fill="#9CA3AF"
                  >
                    {truncate(item.cap, 14)}
                  </text>
                </g>
              )
            }
          })}

          {/* Overflow indicator */}
          {orbitItems.length > 8 && (
            <text
              x={cx}
              y={cy + primaryR + 20}
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontSize={11}
              fill="#9CA3AF"
            >
              +{orbitItems.length - 8} more systems not shown
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-2">
        {Object.entries(QUALITY_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-outsail-gray-600">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: QUALITY_COLORS[key] }}
            />
            <span>{QUALITY_ICONS[key]} {label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-outsail-coral">
          <div className="w-3 h-3 rounded-full flex-shrink-0 border border-outsail-coral" style={{ background: '#FFF5F3' }} />
          <span>Coverage Gap</span>
        </div>
      </div>
    </div>
  )
}

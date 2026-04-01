'use client'

import { useState, useRef } from 'react'
import { VendorCombobox } from './vendor-combobox'
import { StarRating } from './star-rating'
import { HCM_CAPABILITIES, VENDOR_DEFAULT_MODULES } from '@/lib/tech-stack/vendors'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

// ─── Constants ───────────────────────────────────────────────────────────────

const STANDARD_MODULES = HCM_CAPABILITIES.filter((c) => c !== 'Custom')

const VB_W = 900
const VB_H = 580
const CX = VB_W / 2
const CY = VB_H / 2 - 10
const PRIMARY_R = 82
const MODULE_R = 52
const ORBIT_R = 228

// ─── Helpers ─────────────────────────────────────────────────────────────────

function satPos(index: number, total = STANDARD_MODULES.length): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  return {
    x: CX + ORBIT_R * Math.cos(angle),
    y: CY + ORBIT_R * Math.sin(angle),
  }
}

function splitLabel(label: string): string[] {
  const map: Record<string, string[]> = {
    'Time & Attendance': ['Time &', 'Attendance'],
    'Benefits Admin': ['Benefits', 'Admin'],
    'ERP/General Ledger': ['ERP / GL'],
    'Global Payroll': ['Global', 'Payroll'],
    'Recruiting/ATS': ['Recruiting', 'ATS'],
    'Learning/LMS': ['Learning', 'LMS'],
  }
  return map[label] ?? [label]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationQuality = 'fully_integrated' | 'mostly_automated' | 'partially_automated' | 'fully_manual'
type IntegrationDirection = 'to_primary' | 'from_primary' | 'bidirectional'

const QUALITY_OPTIONS: { value: IntegrationQuality; label: string; color: string }[] = [
  { value: 'fully_integrated',    label: 'Fully Integrated',    color: '#1D8348' },
  { value: 'mostly_automated',    label: 'Mostly Automated',    color: '#E5A000' },
  { value: 'partially_automated', label: 'Partially Automated', color: '#D85A30' },
  { value: 'fully_manual',        label: 'Fully Manual',        color: '#D93025' },
]

interface Ratings {
  admin: number
  employee: number
  service: number
}

interface PointSolutionData {
  vendor: string
  ratings: Ratings
  alsoCovers: string[]   // module labels
  notes: string
  integrationQuality: IntegrationQuality
  integrationDirection: IntegrationDirection
}

export interface TechStackCanvasProps {
  projectId: string
  initialPrimaryVendor?: string
  initialCoveredModules?: string[]
  /** Pre-loaded point solutions keyed by module label */
  initialPointSolutions?: Record<string, PointSolutionData>
  onComplete?: () => void
}

// ─── Small reusable UI ────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-outsail-gray-200 bg-outsail-gray-50">
      <span className="text-sm font-medium text-outsail-navy">{label}</span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-outsail-teal/40 ${checked ? 'bg-outsail-teal' : 'bg-outsail-gray-200'}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_RATINGS: Ratings = { admin: 0, employee: 0, service: 0 }
const DEFAULT_QUALITY: IntegrationQuality = 'mostly_automated'
const DEFAULT_DIRECTION: IntegrationDirection = 'bidirectional'

export function TechStackCanvas({
  projectId,
  initialPrimaryVendor = '',
  initialCoveredModules = [],
  initialPointSolutions = {},
  onComplete,
}: TechStackCanvasProps) {
  // ── Persistent state
  const [primaryVendor, setPrimaryVendor] = useState(initialPrimaryVendor)
  const [coveredModules, setCoveredModules] = useState<string[]>(initialCoveredModules)
  const [pointSolutions, setPointSolutions] = useState<Record<string, PointSolutionData>>(initialPointSolutions)

  // ── Primary vendor modal draft state
  const [showPrimaryModal, setShowPrimaryModal] = useState(false)
  const [draftVendor, setDraftVendor] = useState(initialPrimaryVendor)
  const [draftModules, setDraftModules] = useState<string[]>(initialCoveredModules)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Module modal draft state
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [draftHandledByPrimary, setDraftHandledByPrimary] = useState(false)
  const [draftPointVendor, setDraftPointVendor] = useState('')
  const [draftRatings, setDraftRatings] = useState<Ratings>(DEFAULT_RATINGS)
  const [draftAlsoCovers, setDraftAlsoCovers] = useState<string[]>([])
  const [draftNotes, setDraftNotes] = useState('')
  const [draftQuality, setDraftQuality] = useState<IntegrationQuality>(DEFAULT_QUALITY)
  const [draftDirection, setDraftDirection] = useState<IntegrationDirection>(DEFAULT_DIRECTION)
  const [moduleSaving, setModuleSaving] = useState(false)
  const [moduleError, setModuleError] = useState<string | null>(null)

  // ── Add custom module state
  const [customModules, setCustomModules] = useState<string[]>([])
  const [showAddModule, setShowAddModule] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')

  // SVG ref for PNG export
  const svgRef = useRef<SVGSVGElement>(null)

  // All modules = standard + custom
  const allModules = [...STANDARD_MODULES, ...customModules]

  // ── Build PUT payload ─────────────────────────────────────────────────────

  function buildModulesPayload(overrides: Record<string, PointSolutionData | null> = {}) {
    const merged: Record<string, PointSolutionData> = { ...pointSolutions }
    for (const [label, val] of Object.entries(overrides)) {
      if (val === null) {
        delete merged[label]
      } else {
        merged[label] = val
      }
    }
    return Object.entries(merged)
      .filter(([, d]) => d.vendor.trim())
      .map(([label, d]) => ({
        id: label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label,
        isCustom: false,
        canvasX: 0,
        canvasY: 0,
        vendor: d.vendor.trim(),
        vendorNotes: d.notes,
        coveredByPrimary: false,
        ratings: d.ratings,
        integrationQuality: d.integrationQuality,
        integrationDirection: d.integrationDirection,
        alsoCoversLabels: d.alsoCovers,
      }))
  }

  async function putTechStack(pv: string, cm: string[], modulesPayload: ReturnType<typeof buildModulesPayload>) {
    const res = await fetch(`/api/projects/${projectId}/tech-stack`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryVendor: pv,
        primaryModules: cm,
        primaryRatings: { admin: 3, employee: 3, service: 3 },
        modules: modulesPayload,
      }),
    })
    if (!res.ok) throw new Error('Failed to save. Please try again.')
  }

  // ── Module modal open ─────────────────────────────────────────────────────

  function openModuleModal(label: string) {
    const existing = pointSolutions[label]
    setDraftHandledByPrimary(coveredModules.includes(label))
    setDraftPointVendor(existing?.vendor ?? '')
    setDraftRatings(existing?.ratings ?? DEFAULT_RATINGS)
    setDraftAlsoCovers(existing?.alsoCovers ?? [])
    setDraftNotes(existing?.notes ?? '')
    setDraftQuality(existing?.integrationQuality ?? DEFAULT_QUALITY)
    setDraftDirection(existing?.integrationDirection ?? DEFAULT_DIRECTION)
    setModuleError(null)
    setActiveModule(label)
  }

  function toggleAlsoCover(label: string) {
    setDraftAlsoCovers((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  // ── Save module ───────────────────────────────────────────────────────────

  async function handleSaveModule() {
    if (!activeModule) return
    setModuleSaving(true)
    setModuleError(null)

    try {
      let newCoveredModules = coveredModules
      let overrides: Record<string, PointSolutionData | null> = {}

      if (draftHandledByPrimary) {
        newCoveredModules = coveredModules.includes(activeModule)
          ? coveredModules
          : [...coveredModules, activeModule]
        overrides[activeModule] = null
      } else {
        newCoveredModules = coveredModules.filter((m) => m !== activeModule)
        if (draftPointVendor.trim()) {
          overrides[activeModule] = {
            vendor: draftPointVendor.trim(),
            ratings: draftRatings,
            alsoCovers: draftAlsoCovers,
            notes: draftNotes,
            integrationQuality: draftQuality,
            integrationDirection: draftDirection,
          }
        } else {
          overrides[activeModule] = null
        }
      }

      await putTechStack(primaryVendor, newCoveredModules, buildModulesPayload(overrides))

      // Update local state
      setCoveredModules(newCoveredModules)
      setPointSolutions((prev) => {
        const next = { ...prev }
        if (draftHandledByPrimary || !draftPointVendor.trim()) {
          delete next[activeModule]
        } else {
          next[activeModule] = {
            vendor: draftPointVendor.trim(),
            ratings: draftRatings,
            alsoCovers: draftAlsoCovers,
            notes: draftNotes,
            integrationQuality: draftQuality,
            integrationDirection: draftDirection,
          }
        }
        return next
      })
      setActiveModule(null)
    } catch (e) {
      setModuleError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setModuleSaving(false)
    }
  }

  // ── Add custom module ─────────────────────────────────────────────────────

  function handleAddModule() {
    const name = newModuleName.trim()
    if (!name || allModules.includes(name)) return
    setCustomModules((prev) => [...prev, name])
    setNewModuleName('')
    setShowAddModule(false)
  }

  // ── Download PNG ──────────────────────────────────────────────────────────

  function downloadPng() {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = VB_W * 2
      canvas.height = (VB_H + 56) * 2
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#F8F7F4'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = 'tech-stack.png'
      a.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  // ── Primary vendor handlers ───────────────────────────────────────────────

  function openPrimaryModal() {
    setDraftVendor(primaryVendor)
    setDraftModules(coveredModules)
    setSaveError(null)
    setShowPrimaryModal(true)
  }

  function handleDraftVendorChange(v: string) {
    setDraftVendor(v)
    const defaults = VENDOR_DEFAULT_MODULES[v]
    if (defaults) setDraftModules(defaults)
    else if (!primaryVendor) setDraftModules([])
  }

  function toggleDraftModule(label: string) {
    setDraftModules((prev) =>
      prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]
    )
  }

  async function handleSavePrimary() {
    if (!draftVendor.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await putTechStack(draftVendor.trim(), draftModules, buildModulesPayload())
      setPrimaryVendor(draftVendor.trim())
      setCoveredModules(draftModules)
      setShowPrimaryModal(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Canvas ── */}
      <div className="w-full rounded-xl border border-outsail-gray-200 bg-[#F8F7F4] overflow-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H + 56}`}
          className="w-full"
          style={{ minWidth: 600, display: 'block' }}
          aria-label="Tech stack canvas"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Arrow markers for each quality level + both directions */}
          <defs>
            {QUALITY_OPTIONS.map(({ value, color }) => (
              <marker key={`me-${value}`} id={`arrow-end-${value}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={color} />
              </marker>
            ))}
            {QUALITY_OPTIONS.map(({ value, color }) => (
              <marker key={`ms-${value}`} id={`arrow-start-${value}`} markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
                <path d="M0,0 L0,6 L8,3 z" fill={color} />
              </marker>
            ))}
          </defs>

          {/* Dot grid */}
          {Array.from({ length: 10 }, (_, row) =>
            Array.from({ length: 16 }, (_, col) => (
              <circle key={`dot-${row}-${col}`} cx={col * 60 + 30} cy={row * 60 + 30} r={1.5} fill="#E5E3DC" />
            ))
          )}

          {/* Spoke lines — quality-colored with arrowheads for point solutions */}
          {allModules.map((label, i) => {
            const pos = satPos(i, allModules.length)
            const covered = coveredModules.includes(label)
            const psData = pointSolutions[label]
            if (!covered && !psData) return null   // gap modules: no line

            const quality = psData?.integrationQuality ?? 'fully_integrated'
            const direction = psData?.integrationDirection ?? 'bidirectional'
            const color = psData
              ? (QUALITY_OPTIONS.find((q) => q.value === quality)?.color ?? '#1D9E75')
              : '#1D9E75'

            // Shorten line so it doesn't overlap circle borders
            const dx = CX - pos.x
            const dy = CY - pos.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const ux = dx / dist
            const uy = dy / dist
            const x1 = pos.x + ux * (MODULE_R + 2)
            const y1 = pos.y + uy * (MODULE_R + 2)
            const x2 = CX - ux * (PRIMARY_R + 2)
            const y2 = CY - uy * (PRIMARY_R + 2)

            const markerEnd = psData && (direction === 'to_primary' || direction === 'bidirectional')
              ? `url(#arrow-end-${quality})` : undefined
            const markerStart = psData && (direction === 'from_primary' || direction === 'bidirectional')
              ? `url(#arrow-start-${quality})` : undefined

            return (
              <line key={`line-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color}
                strokeWidth={2.5}
                markerEnd={markerEnd}
                markerStart={markerStart}
                opacity={0.75}
              />
            )
          })}

          {/* Satellite circles */}
          {allModules.map((label, i) => {
            const pos = satPos(i, allModules.length)
            const covered = coveredModules.includes(label)
            const psData = pointSolutions[label]
            const isGap = primaryVendor && !covered && !psData
            const lines = splitLabel(label)
            const lineSpacing = 14

            let fill = 'white'
            let stroke = '#D3D1C7'
            let sw = 1.5
            let dash: string | undefined = '7,5'
            if (covered)  { fill = '#E1F5EE'; stroke = '#1D9E75'; sw = 2.5; dash = undefined }
            else if (psData)  { fill = '#EEF2FF'; stroke = '#4338CA'; sw = 2;   dash = undefined }
            else if (isGap)   { fill = '#FFF5F0'; stroke = '#D85A30'; sw = 1.5; dash = '7,5' }

            return (
              <g key={label} onClick={() => openModuleModal(label)} style={{ cursor: 'pointer' }} role="button" aria-label={`Configure ${label}`}>
                <circle cx={pos.x} cy={pos.y} r={MODULE_R + 6} fill="transparent" />
                <circle cx={pos.x} cy={pos.y} r={MODULE_R} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />

                {covered && (
                  <>
                    <circle cx={pos.x + MODULE_R * 0.65} cy={pos.y - MODULE_R * 0.65} r={10} fill="#1D9E75" />
                    <text x={pos.x + MODULE_R * 0.65} y={pos.y - MODULE_R * 0.65 + 4} textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fill="white" fontWeight={700}>✓</text>
                  </>
                )}

                {psData && !covered ? (
                  <>
                    <text x={pos.x} y={pos.y - 8} textAnchor="middle" fontSize={9} fontFamily="Inter, sans-serif" fontWeight={700} fill="#4338CA">
                      {psData.vendor.length > 13 ? psData.vendor.slice(0, 12) + '…' : psData.vendor}
                    </text>
                    {lines.map((line, li) => (
                      <text key={li} x={pos.x} y={pos.y + 7 + li * 11} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#9CA3AF">{line}</text>
                    ))}
                  </>
                ) : isGap ? (
                  <>
                    <text x={pos.x} y={pos.y - 6} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fontWeight={600} fill="#D85A30" letterSpacing={0.5}>NO SYSTEM</text>
                    {lines.map((line, li) => (
                      <text key={li} x={pos.x} y={pos.y + 7 + li * 11} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#D85A30" opacity={0.7}>{line}</text>
                    ))}
                  </>
                ) : (
                  lines.map((line, li) => {
                    const totalH = (lines.length - 1) * lineSpacing
                    const baseY = pos.y - totalH / 2 + li * lineSpacing + 4
                    return (
                      <text key={li} x={pos.x} y={baseY} textAnchor="middle" fontSize={10} fontFamily="Inter, sans-serif" fontWeight={covered ? 600 : 500} fill={covered ? '#0F6E56' : '#6B6B65'}>{line}</text>
                    )
                  })
                )}
              </g>
            )
          })}

          {/* Primary circle */}
          <g onClick={openPrimaryModal} style={{ cursor: 'pointer' }} role="button" aria-label="Edit primary vendor">
            <circle cx={CX} cy={CY} r={PRIMARY_R + 6} fill="transparent" />
            <circle cx={CX} cy={CY} r={PRIMARY_R} fill="white" stroke={primaryVendor ? '#1B3A5C' : '#D3D1C7'} strokeWidth={primaryVendor ? 3 : 2} strokeDasharray={primaryVendor ? undefined : '12,7'} />
            {primaryVendor ? (
              <>
                <text x={CX} y={CY - 12} textAnchor="middle" fontSize={15} fontFamily="Inter, sans-serif" fontWeight={700} fill="#1B3A5C">
                  {primaryVendor.length > 17 ? primaryVendor.slice(0, 16) + '…' : primaryVendor}
                </text>
                <text x={CX} y={CY + 7} textAnchor="middle" fontSize={9} fontFamily="Inter, sans-serif" fill="#9CA3AF" letterSpacing={1}>PRIMARY VENDOR</text>
                <text x={CX} y={CY + 25} textAnchor="middle" fontSize={10} fontFamily="Inter, sans-serif" fill="#1D9E75" fontWeight={500}>
                  {coveredModules.length} module{coveredModules.length !== 1 ? 's' : ''} covered
                </text>
              </>
            ) : (
              <>
                <text x={CX} y={CY - 10} textAnchor="middle" fontSize={32} fontFamily="Inter, sans-serif" fill="#D3D1C7">+</text>
                <text x={CX} y={CY + 14} textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fill="#9CA3AF">Click to set your</text>
                <text x={CX} y={CY + 30} textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fill="#9CA3AF">primary vendor</text>
              </>
            )}
          </g>

          {/* Legend */}
          {(() => {
            const legendY = VB_H + 14
            const itemW = 200
            const startX = (VB_W - QUALITY_OPTIONS.length * itemW) / 2
            return (
              <g>
                <text x={VB_W / 2} y={legendY} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#9CA3AF" letterSpacing={1.5}>
                  INTEGRATION QUALITY
                </text>
                {QUALITY_OPTIONS.map(({ value, label, color }, i) => (
                  <g key={value}>
                    <circle cx={startX + i * itemW + 6} cy={legendY + 16} r={5} fill={color} />
                    <text x={startX + i * itemW + 16} y={legendY + 20} fontSize={9} fontFamily="Inter, sans-serif" fill="#6B6B65">{label}</text>
                  </g>
                ))}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* ── Action bar: Add Module / Download PNG / Continue ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {showAddModule ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddModule()
                  if (e.key === 'Escape') { setShowAddModule(false); setNewModuleName('') }
                }}
                placeholder="Module name…"
                autoFocus
                className="px-3 py-1.5 text-sm border border-outsail-gray-200 rounded-card focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal w-44"
              />
              <button type="button" onClick={handleAddModule} className="px-3 py-1.5 bg-outsail-teal text-white text-sm rounded-card hover:bg-outsail-teal/90">Add</button>
              <button type="button" onClick={() => { setShowAddModule(false); setNewModuleName('') }} className="px-3 py-1.5 border border-outsail-gray-200 text-sm text-outsail-gray-600 rounded-card">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddModule(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-outsail-gray-600 border border-outsail-gray-200 rounded-card hover:border-outsail-navy hover:text-outsail-navy transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Module
            </button>
          )}
          <button
            type="button"
            onClick={downloadPng}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-outsail-gray-600 border border-outsail-gray-200 rounded-card hover:border-outsail-navy hover:text-outsail-navy transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PNG
          </button>
        </div>
        {primaryVendor && onComplete && (
          <button
            type="button"
            onClick={onComplete}
            className="px-6 py-2.5 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 transition-colors"
          >
            Continue →
          </button>
        )}
      </div>

      {/* ── Module modal ── */}
      <Dialog open={activeModule !== null} onOpenChange={(open) => { if (!open && !moduleSaving) setActiveModule(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div>
              <DialogTitle>{activeModule}</DialogTitle>
              <DialogDescription>Configure how this module is covered in your tech stack.</DialogDescription>
            </div>
            <DialogClose asChild>
              <button type="button" disabled={moduleSaving} className="rounded p-1 text-outsail-gray-600 hover:text-outsail-navy transition-colors" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </DialogClose>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 max-h-[68vh] overflow-y-auto">
            {/* Primary toggle */}
            {primaryVendor ? (
              <Toggle checked={draftHandledByPrimary} onChange={setDraftHandledByPrimary} label={`Handled by ${primaryVendor}`} />
            ) : (
              <p className="text-sm text-outsail-gray-600">Set a primary vendor first to mark modules as covered.</p>
            )}

            {/* Point solution section — shown when NOT handled by primary */}
            {!draftHandledByPrimary && (
              <>
                {/* Vendor search */}
                <div className="space-y-1.5">
                  <label className="block text-label text-outsail-navy">Point Solution Vendor</label>
                  <VendorCombobox
                    value={draftPointVendor}
                    onChange={setDraftPointVendor}
                    placeholder={`Search ${activeModule ?? ''} vendors…`}
                    category={activeModule ?? ''}
                  />
                  <p className="text-xs text-outsail-gray-600">Can&apos;t find yours? Type the name and press Enter.</p>
                </div>

                {/* Only show the rest once a vendor is selected */}
                {draftPointVendor && (
                  <>
                    {/* Star ratings */}
                    <div className="space-y-2">
                      <p className="text-label text-outsail-navy">Ratings</p>
                      <StarRating
                        label="Admin Experience"
                        value={draftRatings.admin}
                        onChange={(v) => setDraftRatings((r) => ({ ...r, admin: v }))}
                      />
                      <StarRating
                        label="Employee Experience"
                        value={draftRatings.employee}
                        onChange={(v) => setDraftRatings((r) => ({ ...r, employee: v }))}
                      />
                      <StarRating
                        label="Service / Support"
                        value={draftRatings.service}
                        onChange={(v) => setDraftRatings((r) => ({ ...r, service: v }))}
                      />
                    </div>

                    {/* Also covers */}
                    <div className="space-y-2">
                      <p className="text-label text-outsail-navy">Also covers</p>
                      <p className="text-xs text-outsail-gray-600">Select other modules this vendor handles.</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {STANDARD_MODULES.filter((m) => m !== activeModule).map((m) => {
                          const checked = draftAlsoCovers.includes(m)
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => toggleAlsoCover(m)}
                              className={`flex items-center gap-2 p-2 rounded-card border text-left transition-all text-xs ${
                                checked
                                  ? 'border-outsail-teal bg-outsail-teal/5 text-outsail-navy font-medium'
                                  : 'border-outsail-gray-200 text-outsail-gray-600 hover:border-outsail-teal/40'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${checked ? 'bg-outsail-teal border-outsail-teal' : 'border-outsail-gray-300'}`}>
                                {checked && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className="leading-tight">{m}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="block text-label text-outsail-navy">Notes</label>
                      <textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        placeholder="Sub-functions, contract details, integration notes…"
                        rows={3}
                        className="w-full px-3 py-2 border border-outsail-gray-200 rounded-card text-sm text-outsail-slate bg-white focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 focus:border-outsail-teal resize-none"
                      />
                    </div>

                    {/* Integration quality */}
                    <div className="space-y-2">
                      <p className="text-label text-outsail-navy">Integration Quality</p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUALITY_OPTIONS.map(({ value, label, color }) => (
                          <label
                            key={value}
                            className={`flex items-center gap-2.5 p-2.5 rounded-card border-2 cursor-pointer transition-all ${
                              draftQuality === value
                                ? 'border-current'
                                : 'border-outsail-gray-200 hover:border-outsail-gray-300'
                            }`}
                            style={draftQuality === value ? { borderColor: color, backgroundColor: color + '18' } : {}}
                          >
                            <input
                              type="radio"
                              name="integrationQuality"
                              value={value}
                              checked={draftQuality === value}
                              onChange={() => setDraftQuality(value)}
                              className="sr-only"
                            />
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-outsail-navy leading-tight">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Integration direction */}
                    <div className="space-y-2">
                      <p className="text-label text-outsail-navy">Integration Direction</p>
                      <div className="flex gap-2">
                        {([
                          { value: 'to_primary',    label: primaryVendor ? `→ To ${primaryVendor}` : '→ To Primary' },
                          { value: 'from_primary',  label: primaryVendor ? `← From ${primaryVendor}` : '← From Primary' },
                          { value: 'bidirectional', label: '↔ Bidirectional' },
                        ] as { value: IntegrationDirection; label: string }[]).map(({ value, label }) => (
                          <label
                            key={value}
                            className={`flex-1 flex items-center justify-center px-2 py-2 rounded-card border-2 cursor-pointer text-xs font-medium text-center transition-all ${
                              draftDirection === value
                                ? 'border-outsail-navy bg-outsail-navy text-white'
                                : 'border-outsail-gray-200 text-outsail-gray-600 hover:border-outsail-navy'
                            }`}
                          >
                            <input
                              type="radio"
                              name="integrationDirection"
                              value={value}
                              checked={draftDirection === value}
                              onChange={() => setDraftDirection(value)}
                              className="sr-only"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {moduleError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-700">{moduleError}</div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={handleSaveModule}
              disabled={moduleSaving}
              className="flex-1 px-4 py-2.5 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {moduleSaving ? <><Spinner /> Saving…</> : 'Save'}
            </button>
            <DialogClose asChild>
              <button type="button" disabled={moduleSaving} className="px-4 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-label hover:border-outsail-navy transition-colors">
                Cancel
              </button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Primary vendor modal ── */}
      {showPrimaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowPrimaryModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outsail-gray-200">
              <div>
                <h2 className="text-header-sm text-outsail-navy">{primaryVendor ? 'Update Primary HR Platform' : 'Set Primary HR Platform'}</h2>
                <p className="text-xs text-outsail-gray-600 mt-0.5">Your core system of record for employee data</p>
              </div>
              <button type="button" onClick={() => setShowPrimaryModal(false)} disabled={saving} className="text-outsail-gray-600 hover:text-outsail-navy p-1 rounded">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-label text-outsail-navy mb-1.5">HR Platform</label>
                <VendorCombobox value={draftVendor} onChange={handleDraftVendorChange} placeholder="Search primary HR platforms..." canBePrimary={true} />
                <p className="text-xs text-outsail-gray-600 mt-1.5">Can&apos;t find yours? Type the name and press Enter.</p>
              </div>

              {draftVendor && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-label text-outsail-navy">Which modules does {draftVendor} cover?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setDraftModules(STANDARD_MODULES)} className="text-xs text-outsail-teal hover:underline">All</button>
                      <span className="text-outsail-gray-200">·</span>
                      <button type="button" onClick={() => setDraftModules([])} className="text-xs text-outsail-gray-600 hover:underline">None</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {STANDARD_MODULES.map((label) => {
                      const checked = draftModules.includes(label)
                      return (
                        <button key={label} type="button" onClick={() => toggleDraftModule(label)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-card border-2 text-left transition-all ${checked ? 'border-outsail-teal bg-outsail-teal/5 text-outsail-navy' : 'border-outsail-gray-200 bg-white text-outsail-gray-600 hover:border-outsail-teal/40'}`}>
                          <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 ${checked ? 'bg-outsail-teal border-outsail-teal' : 'border-outsail-gray-200 bg-white'}`}>
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className="text-xs font-medium leading-tight">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-outsail-gray-600 mt-2.5">{draftModules.length} of {STANDARD_MODULES.length} modules selected</p>
                </div>
              )}

              {saveError && <div className="p-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-700">{saveError}</div>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-outsail-gray-200 bg-outsail-gray-50">
              <button type="button" onClick={handleSavePrimary} disabled={!draftVendor.trim() || saving}
                className="flex-1 px-4 py-2.5 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {saving ? <><Spinner />Saving…</> : 'Save Primary Vendor'}
              </button>
              <button type="button" onClick={() => setShowPrimaryModal(false)} disabled={saving}
                className="px-4 py-2 border border-outsail-gray-200 text-outsail-gray-600 rounded-card text-label hover:border-outsail-navy transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

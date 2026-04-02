'use client'

import { useState, useRef } from 'react'
import { VendorCombobox, type VendorResult } from './vendor-combobox'
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
const PRIMARY_R_ACTIVE = 100
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
    'Core HR': ['Core HR'],
    'Engagement': ['Engagement'],
  }
  return map[label] ?? [label]
}

function moduleAbbr(label: string): string {
  const map: Record<string, string> = {
    'Payroll': 'PR', 'HRIS': 'HR', 'Benefits Admin': 'BN',
    'Core HR': 'HR', 'Time & Attendance': 'TA', 'Recruiting/ATS': 'AT', 'Learning/LMS': 'LM',
    'Performance': 'PM', 'Workforce Management': 'WM', 'Compensation': 'CP',
    'Onboarding': 'ON', 'Offboarding': 'OB', 'ERP/General Ledger': 'GL',
    'Global Payroll': 'GP', 'Expense': 'EX', 'Expense Management': 'EX',
    'Engagement': 'EG', 'SSO': 'SS', 'Scheduling': 'SC', 'Analytics': 'AN',
  }
  return map[label] ?? label.slice(0, 2).toUpperCase()
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
  /** Pre-loaded point solutions keyed by module label (multiple per module allowed) */
  initialPointSolutions?: Record<string, PointSolutionData[]>
  initialCustomModules?: string[]
  readOnly?: boolean
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
  initialCustomModules = [],
  readOnly = false,
  onComplete,
}: TechStackCanvasProps) {
  // ── Persistent state
  const [primaryVendor, setPrimaryVendor] = useState(initialPrimaryVendor)
  const [coveredModules, setCoveredModules] = useState<string[]>(initialCoveredModules)
  const [pointSolutions, setPointSolutions] = useState<Record<string, PointSolutionData[]>>(initialPointSolutions)

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
  const [customModules, setCustomModules] = useState<string[]>(initialCustomModules)
  const [showAddModule, setShowAddModule] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')

  const [draftVendorMeta, setDraftVendorMeta] = useState<{ logo_url: string | null; primary_color: string | null } | null>(null)
  const [primaryVendorMeta, setPrimaryVendorMeta] = useState<{ logo_url: string | null; primary_color: string | null } | null>(null)

  // SVG ref for PNG export
  const svgRef = useRef<SVGSVGElement>(null)

  // All modules = standard + custom
  const allModules = [...STANDARD_MODULES, ...customModules]

  // ── Build PUT payload ─────────────────────────────────────────────────────

  function buildModulesPayload(overrides: Record<string, PointSolutionData[] | null> = {}) {
    const merged: Record<string, PointSolutionData[]> = { ...pointSolutions }
    for (const [label, val] of Object.entries(overrides)) {
      if (val === null) {
        delete merged[label]
      } else {
        merged[label] = val
      }
    }
    return Object.entries(merged).flatMap(([label, solutions]) =>
      solutions
        .filter((d) => d.vendor.trim())
        .map((d, idx) => ({
          id: `${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${idx}`,
          label,
          isCustom: customModules.includes(label),
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
    )
  }

  async function putTechStack(pv: string, cm: string[], modulesPayload: ReturnType<typeof buildModulesPayload>, latestCustomModules: string[] = customModules) {
    const res = await fetch(`/api/projects/${projectId}/tech-stack`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryVendor: pv,
        primaryModules: cm,
        primaryRatings: { admin: 3, employee: 3, service: 3 },
        modules: modulesPayload,
        customModules: latestCustomModules,
      }),
    })
    if (!res.ok) throw new Error('Failed to save. Please try again.')
  }

  // ── Module modal open ─────────────────────────────────────────────────────

  function openModuleModal(label: string) {
    const existing = (pointSolutions[label] ?? [])[0]
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
      let overrides: Record<string, PointSolutionData[] | null> = {}

      if (draftHandledByPrimary) {
        newCoveredModules = coveredModules.includes(activeModule)
          ? coveredModules
          : [...coveredModules, activeModule]
        overrides[activeModule] = null
      } else {
        newCoveredModules = coveredModules.filter((m) => m !== activeModule)
        if (draftPointVendor.trim()) {
          const newSolution: PointSolutionData = {
            vendor: draftPointVendor.trim(),
            ratings: draftRatings,
            alsoCovers: draftAlsoCovers,
            notes: draftNotes,
            integrationQuality: draftQuality,
            integrationDirection: draftDirection,
          }
          const existing = pointSolutions[activeModule] ?? []
          const idx = existing.findIndex((s) => s.vendor === draftPointVendor.trim())
          if (idx >= 0) {
            const updated = [...existing]
            updated[idx] = newSolution
            overrides[activeModule] = updated
          } else {
            overrides[activeModule] = [...existing, newSolution]
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
          const newSolution: PointSolutionData = {
            vendor: draftPointVendor.trim(),
            ratings: draftRatings,
            alsoCovers: draftAlsoCovers,
            notes: draftNotes,
            integrationQuality: draftQuality,
            integrationDirection: draftDirection,
          }
          const existing = prev[activeModule] ?? []
          const idx = existing.findIndex((s) => s.vendor === draftPointVendor.trim())
          if (idx >= 0) {
            const updated = [...existing]
            updated[idx] = newSolution
            next[activeModule] = updated
          } else {
            next[activeModule] = [...existing, newSolution]
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

  async function handleAddModule() {
    const name = newModuleName.trim()
    if (!name || allModules.includes(name)) return
    const updated = [...customModules, name]
    setCustomModules(updated)
    setNewModuleName('')
    setShowAddModule(false)
    if (primaryVendor) {
      try {
        await putTechStack(primaryVendor, coveredModules, buildModulesPayload(), updated)
      } catch {
        // Non-fatal: module is visible on canvas; will be saved on next interaction
      }
    }
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
    setDraftVendorMeta(null)
    const defaults = VENDOR_DEFAULT_MODULES[v]
    if (defaults) setDraftModules(defaults)
    else if (!primaryVendor) setDraftModules([])
  }

  function handleDraftVendorSelectFull(vendor: VendorResult | null) {
    setDraftVendorMeta(vendor ? { logo_url: vendor.logo_url, primary_color: vendor.primary_color } : null)
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
      setPrimaryVendorMeta(draftVendorMeta)
      setShowPrimaryModal(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const satelliteModules = primaryVendor
    ? allModules.filter(label => !coveredModules.includes(label))
    : allModules
  const activeR = primaryVendor ? PRIMARY_R_ACTIVE : PRIMARY_R

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
          {satelliteModules.map((label, i) => {
            const pos = satPos(i, satelliteModules.length)
            const psSolutions = pointSolutions[label]
            const firstPs = psSolutions?.[0]
            if (!firstPs) return null   // gap modules: no line

            const quality = firstPs.integrationQuality
            const direction = firstPs.integrationDirection
            const color = QUALITY_OPTIONS.find((q) => q.value === quality)?.color ?? '#1D9E75'

            // Shorten line so it doesn't overlap circle borders
            const dx = CX - pos.x
            const dy = CY - pos.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const ux = dx / dist
            const uy = dy / dist
            const x1 = pos.x + ux * (MODULE_R + 2)
            const y1 = pos.y + uy * (MODULE_R + 2)
            const x2 = CX - ux * (activeR + 2)
            const y2 = CY - uy * (activeR + 2)

            const markerEnd = direction === 'to_primary' || direction === 'bidirectional'
              ? `url(#arrow-end-${quality})` : undefined
            const markerStart = direction === 'from_primary' || direction === 'bidirectional'
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

          {/* Satellite circles — only uncovered modules (+ those with point solutions) */}
          {satelliteModules.map((label, i) => {
            const pos = satPos(i, satelliteModules.length)
            const psSolutions = pointSolutions[label]
            const firstPs = psSolutions?.[0]
            const psCount = psSolutions?.length ?? 0
            const isGap = primaryVendor && psCount === 0
            const lines = splitLabel(label)
            const lineSpacing = 14

            let fill = 'white'
            let stroke = '#D3D1C7'
            let sw = 1.5
            let dash: string | undefined = '7,5'
            if (psCount > 0) { fill = '#EEF2FF'; stroke = '#4338CA'; sw = 2; dash = undefined }
            else if (isGap) { fill = '#FFF5F0'; stroke = '#D85A30'; sw = 1.5; dash = '7,5' }

            return (
              <g key={label} onClick={readOnly ? undefined : () => openModuleModal(label)} style={{ cursor: readOnly ? 'default' : 'pointer' }} role={readOnly ? undefined : 'button'} aria-label={readOnly ? label : `Configure ${label}`}>
                <circle cx={pos.x} cy={pos.y} r={MODULE_R + 6} fill="transparent" />
                <circle cx={pos.x} cy={pos.y} r={MODULE_R} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />

                {psCount > 0 ? (
                  <>
                    <text x={pos.x} y={pos.y - 8} textAnchor="middle" fontSize={9} fontFamily="Inter, sans-serif" fontWeight={700} fill="#4338CA">
                      {(firstPs?.vendor ?? '').length > 13 ? (firstPs?.vendor ?? '').slice(0, 12) + '…' : (firstPs?.vendor ?? '')}
                    </text>
                    {lines.map((line, li) => (
                      <text key={li} x={pos.x} y={pos.y + 7 + li * 11} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#9CA3AF">{line}</text>
                    ))}
                    {psCount > 1 && (
                      <>
                        <circle cx={pos.x + MODULE_R * 0.65} cy={pos.y - MODULE_R * 0.65} r={10} fill="#4338CA" />
                        <text x={pos.x + MODULE_R * 0.65} y={pos.y - MODULE_R * 0.65 + 4} textAnchor="middle" fontSize={9} fontFamily="Inter, sans-serif" fill="white" fontWeight={700}>+{psCount - 1}</text>
                      </>
                    )}
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
                      <text key={li} x={pos.x} y={baseY} textAnchor="middle" fontSize={10} fontFamily="Inter, sans-serif" fontWeight={500} fill="#6B6B65">{line}</text>
                    )
                  })
                )}
              </g>
            )
          })}

          {/* Primary circle */}
          <g onClick={readOnly ? undefined : openPrimaryModal} style={{ cursor: readOnly ? 'default' : 'pointer' }} role={readOnly ? undefined : 'button'} aria-label={readOnly ? 'Primary vendor' : 'Edit primary vendor'}>
            <circle cx={CX} cy={CY} r={activeR + 6} fill="transparent" />
            <circle cx={CX} cy={CY} r={activeR} fill="white"
              stroke={primaryVendor ? (primaryVendorMeta?.primary_color ?? '#1B3A5C') : '#D3D1C7'}
              strokeWidth={primaryVendor ? 3 : 2}
              strokeDasharray={primaryVendor ? undefined : '12,7'}
            />
            {primaryVendor ? (() => {
              const iconR = 8
              const iconStep = 20
              const maxPerRow = 5
              const iconsToShow = coveredModules.slice(0, 10)
              const rows = Math.max(1, Math.ceil(iconsToShow.length / maxPerRow))
              const iconColor = primaryVendorMeta?.primary_color ?? '#1D9E75'
              const logoUrl = primaryVendorMeta?.logo_url
              return (
                <>
                  {logoUrl ? (
                    <>
                      <image href={logoUrl} x={CX - 18} y={CY - 62} width={36} height={36}
                        clipPath="url(#primaryLogoClip)" preserveAspectRatio="xMidYMid meet" />
                      <clipPath id="primaryLogoClip">
                        <circle cx={CX} cy={CY - 44} r={18} />
                      </clipPath>
                      <text x={CX} y={CY - 20} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#9CA3AF" letterSpacing={1}>PRIMARY VENDOR</text>
                    </>
                  ) : (
                    <>
                      <text x={CX} y={CY - 36} textAnchor="middle" fontSize={14} fontFamily="Inter, sans-serif" fontWeight={700} fill="#1B3A5C">
                        {primaryVendor.length > 18 ? primaryVendor.slice(0, 17) + '…' : primaryVendor}
                      </text>
                      <text x={CX} y={CY - 20} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#9CA3AF" letterSpacing={1}>PRIMARY VENDOR</text>
                    </>
                  )}
                  {iconsToShow.map((label, idx) => {
                    const row = Math.floor(idx / maxPerRow)
                    const col = idx % maxPerRow
                    const countInRow = row < rows - 1 ? maxPerRow : (iconsToShow.length - (rows - 1) * maxPerRow)
                    const rowStartX = CX - ((countInRow - 1) * iconStep) / 2
                    const ix = rowStartX + col * iconStep
                    const iy = rows === 1 ? CY - 4 : CY - 8 + row * iconStep
                    return (
                      <g key={label}>
                        <circle cx={ix} cy={iy} r={iconR} fill={iconColor} opacity={0.15} />
                        <circle cx={ix} cy={iy} r={iconR} fill="none" stroke={iconColor} strokeWidth={1.5} />
                        <text x={ix} y={iy + 3} textAnchor="middle" fontSize={6.5} fontFamily="Inter, sans-serif" fontWeight={700} fill={iconColor}>
                          {moduleAbbr(label)}
                        </text>
                        <title>{label}</title>
                      </g>
                    )
                  })}
                  {coveredModules.length > 10 && (
                    <text x={CX} y={CY + (rows === 1 ? 14 : 4 + (rows - 1) * iconStep)} textAnchor="middle" fontSize={8} fontFamily="Inter, sans-serif" fill="#9CA3AF">+{coveredModules.length - 10} more</text>
                  )}
                  <text x={CX} y={CY + 38} textAnchor="middle" fontSize={9} fontFamily="Inter, sans-serif" fill="#1D9E75" fontWeight={500}>
                    {coveredModules.length} module{coveredModules.length !== 1 ? 's' : ''} covered
                  </text>
                </>
              )
            })() : (
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
          {!readOnly && (showAddModule ? (
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
          ))}
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
        {!readOnly && primaryVendor && onComplete && (
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
      <Dialog open={!readOnly && activeModule !== null} onOpenChange={(open) => { if (!open && !moduleSaving) setActiveModule(null) }}>
        <DialogContent className="max-w-md overflow-visible">
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

          {/* Primary toggle + vendor combobox OUTSIDE scroll container to avoid overflow clipping */}
          <div className="px-6 pt-4 pb-3 space-y-4">
            {primaryVendor ? (
              <Toggle checked={draftHandledByPrimary} onChange={setDraftHandledByPrimary} label={`Handled by ${primaryVendor}`} />
            ) : (
              <p className="text-sm text-outsail-gray-600">Set a primary vendor first to mark modules as covered.</p>
            )}

            {!draftHandledByPrimary && (
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
            )}
          </div>

          {/* Ratings + additional fields in scroll container */}
          {!draftHandledByPrimary && draftPointVendor && (
            <div className="px-6 pb-5 space-y-5 max-h-[45vh] overflow-y-auto border-t border-outsail-gray-100">
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
            </div>
          )}

          {moduleError && (
            <div className="px-6 pb-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-700">{moduleError}</div>
            </div>
          )}

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
      {!readOnly && showPrimaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowPrimaryModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl z-10">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outsail-gray-200 rounded-t-xl">
              <div>
                <h2 className="text-header-sm text-outsail-navy">{primaryVendor ? 'Update Primary HR Platform' : 'Set Primary HR Platform'}</h2>
                <p className="text-xs text-outsail-gray-600 mt-0.5">Your core system of record for employee data</p>
              </div>
              <button type="button" onClick={() => setShowPrimaryModal(false)} disabled={saving} className="text-outsail-gray-600 hover:text-outsail-navy p-1 rounded">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Vendor combobox OUTSIDE scroll container to prevent overflow clipping */}
            <div className="px-6 pt-5 pb-4">
              <label className="block text-label text-outsail-navy mb-1.5">HR Platform</label>
              <VendorCombobox value={draftVendor} onChange={handleDraftVendorChange} onSelectFull={handleDraftVendorSelectFull} placeholder="Search primary HR platforms..." canBePrimary={true} />
              <p className="text-xs text-outsail-gray-600 mt-1.5">Can&apos;t find yours? Type the name and press Enter.</p>
            </div>

            {draftVendor && (
              <div className="px-6 pb-5 space-y-5 max-h-[50vh] overflow-y-auto border-t border-outsail-gray-100">
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
              </div>
            )}

            {saveError && (
              <div className="px-6 pb-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-card text-sm text-red-700">{saveError}</div>
              </div>
            )}

            <div className="flex gap-3 px-6 py-4 border-t border-outsail-gray-200 bg-outsail-gray-50 rounded-b-xl">
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

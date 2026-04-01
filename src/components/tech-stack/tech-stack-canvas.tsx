'use client'

import { useState } from 'react'
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

function satPos(index: number): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / STANDARD_MODULES.length - Math.PI / 2
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
  const [moduleSaving, setModuleSaving] = useState(false)
  const [moduleError, setModuleError] = useState<string | null>(null)

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
        integrationQuality: 'mostly_automated' as const,
        integrationDirection: 'bidirectional' as const,
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
      <div className="w-full rounded-xl border border-outsail-gray-200 bg-[#F8F7F4] overflow-hidden">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full"
          style={{ maxHeight: 580, display: 'block' }}
          aria-label="Tech stack canvas"
        >
          {/* Dot grid */}
          {Array.from({ length: 10 }, (_, row) =>
            Array.from({ length: 16 }, (_, col) => (
              <circle key={`dot-${row}-${col}`} cx={col * 60 + 30} cy={row * 60 + 30} r={1.5} fill="#E5E3DC" />
            ))
          )}

          {/* Spoke lines */}
          {STANDARD_MODULES.map((label, i) => {
            const pos = satPos(i)
            const covered = coveredModules.includes(label)
            const hasPS = Boolean(pointSolutions[label])
            const active = covered || hasPS
            return (
              <line key={`line-${i}`} x1={CX} y1={CY} x2={pos.x} y2={pos.y}
                stroke={active ? '#1D9E75' : '#D3D1C7'}
                strokeWidth={active ? 2 : 1.5}
                strokeDasharray={active ? undefined : '6,4'}
                opacity={active ? 0.6 : 0.4}
              />
            )
          })}

          {/* Satellite circles */}
          {STANDARD_MODULES.map((label, i) => {
            const pos = satPos(i)
            const covered = coveredModules.includes(label)
            const psData = pointSolutions[label]
            const lines = splitLabel(label)
            const lineSpacing = 14

            let fill = 'white'
            let stroke = '#D3D1C7'
            let sw = 1.5
            let dash: string | undefined = '7,5'
            if (covered) { fill = '#E1F5EE'; stroke = '#1D9E75'; sw = 2.5; dash = undefined }
            else if (psData) { fill = '#EEF2FF'; stroke = '#4338CA'; sw = 2; dash = undefined }

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
        </svg>
      </div>

      {/* Continue */}
      {primaryVendor && onComplete && (
        <div className="flex justify-end">
          <button type="button" onClick={onComplete} className="px-6 py-2.5 bg-outsail-teal text-white rounded-card text-label font-medium hover:bg-outsail-teal/90 transition-colors">
            Continue to next step →
          </button>
        </div>
      )}

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

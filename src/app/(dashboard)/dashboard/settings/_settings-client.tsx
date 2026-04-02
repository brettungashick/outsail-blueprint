'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, Shield, ChevronRight, Upload, X, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  must_change_password: boolean | null
  is_active: boolean | null
  created_at: string | null
}

interface ProjectRow {
  id: string
  client_company_name: string
  status: string | null
  tier: string | null
  updated_at: string | null
  created_at: string | null
  advisor_name: string | null
  advisor_email: string | null
}

interface SettingsClientProps {
  currentUserId: string
  currentRole: string
  displayEmail: string
  displayName: string
  displayRole: string
  initials: string
  users: UserRow[]
  projects: ProjectRow[]
  currentLogo: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', advisor: 'Advisor', client: 'Client', vendor: 'Vendor',
}

const ROLE_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  admin: 'default', advisor: 'secondary', client: 'outline', vendor: 'outline',
}

const STATUS_LABELS: Record<string, string> = {
  intake: 'Intake',
  discovery_complete: 'Discovery Done',
  summary_approved: 'Summary Approved',
  deep_discovery: 'Deep Discovery',
  blueprint_generation: 'Generating',
  client_review: 'Client Review',
  approved: 'Approved',
  outputs: 'Outputs',
}

const STATUS_COLORS: Record<string, string> = {
  intake: 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200',
  discovery_complete: 'bg-blue-50 text-blue-700 border-blue-200',
  summary_approved: 'bg-blue-50 text-blue-700 border-blue-200',
  deep_discovery: 'bg-amber-50 text-amber-700 border-amber-200',
  blueprint_generation: 'bg-purple-50 text-purple-700 border-purple-200',
  client_review: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-outsail-teal/10 text-outsail-teal border-outsail-teal/30',
  outputs: 'bg-outsail-teal/10 text-outsail-teal border-outsail-teal/30',
}

const TIER_LABELS: Record<string, string> = {
  essentials: 'Essentials', growth: 'Growth', enterprise: 'Enterprise',
}

function formatDate(val: string | null): string {
  if (!val) return '—'
  try {
    const d = new Date(typeof val === 'number' ? (val as number) * 1000 : val)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '—' }
}

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsClient({
  currentUserId, currentRole, displayEmail, displayName, displayRole, initials,
  users: initialUsers, projects: initialProjects, currentLogo,
}: SettingsClientProps) {
  const router = useRouter()
  const isAdmin = currentRole === 'admin'
  const [activeTab, setActiveTab] = useState<'general' | 'projects' | 'users' | 'vendors'>('general')

  // ── Logo state ─────────────────────────────────────────────────────────────
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo] = useState<string | null>(currentLogo)
  const [logoSaving, setLogoSaving] = useState(false)
  const [logoMsg, setLogoMsg] = useState<string | null>(null)

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setLogoMsg('Logo must be under 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function saveLogo(value: string | null) {
    setLogoSaving(true)
    setLogoMsg(null)
    try {
      const res = await fetch('/api/admin/app-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: value }),
      })
      if (res.ok) {
        setLogoMsg(value ? '✓ Logo saved' : '✓ Logo removed')
        router.refresh()
      } else {
        setLogoMsg('Failed to save logo')
      }
    } catch { setLogoMsg('Network error') }
    finally { setLogoSaving(false) }
  }

  function handleRemoveLogo() {
    setLogo(null)
    saveLogo(null)
  }

  // ── Projects state ─────────────────────────────────────────────────────────
  const [projects] = useState<ProjectRow[]>(initialProjects)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState('')
  const [projectAdvisorFilter, setProjectAdvisorFilter] = useState('')
  const [projectSort, setProjectSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({
    col: 'updated_at', dir: 'desc',
  })

  const advisorOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { email: string; name: string | null }[] = []
    for (const p of projects) {
      if (p.advisor_email && !seen.has(p.advisor_email)) {
        seen.add(p.advisor_email)
        opts.push({ email: p.advisor_email, name: p.advisor_name })
      }
    }
    return opts
  }, [projects])

  const filteredProjects = useMemo(() => {
    let rows = projects.filter((p) => {
      const matchSearch = !projectSearch ||
        p.client_company_name.toLowerCase().includes(projectSearch.toLowerCase())
      const matchStatus = !projectStatusFilter || p.status === projectStatusFilter
      const matchAdvisor = !projectAdvisorFilter || p.advisor_email === projectAdvisorFilter
      return matchSearch && matchStatus && matchAdvisor
    })

    rows = [...rows].sort((a, b) => {
      const aVal = a[projectSort.col as keyof ProjectRow] ?? ''
      const bVal = b[projectSort.col as keyof ProjectRow] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal))
      return projectSort.dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [projects, projectSearch, projectStatusFilter, projectAdvisorFilter, projectSort])

  function toggleSort(col: string) {
    setProjectSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }

  // ── Users state ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [togglingActive, setTogglingActive] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<Record<string, string>>({})

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    setInviteSuccess(null)
    try {
      const res = await fetch('/api/auth/invite-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inviteName.trim() || undefined, email: inviteEmail.trim() }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; tempPassword?: string }
      if (!res.ok) { setInviteError(data.error ?? 'Failed to invite advisor.'); return }
      setInviteSuccess(`Invited! Temp password: ${data.tempPassword}`)
      setInviteName('')
      setInviteEmail('')
      const usersRes = await fetch('/api/admin/users')
      if (usersRes.ok) {
        const usersData = await usersRes.json() as { users: UserRow[] }
        setUsers(usersData.users)
      }
    } catch { setInviteError('Network error.') }
    finally { setInviting(false) }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setChangingRole(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
        if (userId === currentUserId) router.refresh()
      }
    } catch { /* ignore */ }
    finally { setChangingRole(null) }
  }

  async function handleToggleActive(userId: string, currentActive: boolean | null) {
    const newValue = currentActive === false ? true : false
    setTogglingActive(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newValue }),
      })
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: newValue } : u))
      }
    } catch { /* ignore */ }
    finally { setTogglingActive(null) }
  }

  async function handleResendInvite(userId: string) {
    setResendingId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend-invite`, { method: 'POST' })
      const data = await res.json() as { ok?: boolean; tempPassword?: string; error?: string }
      if (res.ok && data.ok) {
        setResendResult((prev) => ({ ...prev, [userId]: `New temp pw: ${data.tempPassword}` }))
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, must_change_password: true } : u))
      } else {
        setResendResult((prev) => ({ ...prev, [userId]: data.error ?? 'Failed' }))
      }
    } catch {
      setResendResult((prev) => ({ ...prev, [userId]: 'Network error' }))
    } finally { setResendingId(null) }
  }

  // ── Tab definitions ────────────────────────────────────────────────────────
  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'projects' as const, label: 'Projects', adminOnly: true },
    { id: 'users' as const, label: 'Users', adminOnly: true },
    { id: 'vendors' as const, label: 'Vendors', adminOnly: true },
  ]

  const inputClass = "h-9 px-3 rounded-md border border-outsail-gray-200 bg-white text-sm text-outsail-slate placeholder:text-outsail-gray-600 focus:outline-none focus:ring-2 focus:ring-outsail-teal focus:border-transparent disabled:opacity-50"

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-header-lg text-outsail-navy">Settings</h1>
        <p className="text-body text-outsail-gray-600 mt-1">Manage your account and application preferences.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-outsail-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            if (tab.adminOnly && !isAdmin) return null
            return (
              <button key={tab.id} type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-outsail-teal text-outsail-teal'
                    : 'border-transparent text-outsail-gray-600 hover:text-outsail-navy'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── GENERAL TAB ── */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Profile card */}
          <div className="bg-white rounded-xl border border-outsail-gray-200 p-6">
            <h2 className="text-sm font-semibold text-outsail-navy mb-4">Profile</h2>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-outsail-teal flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-outsail-navy">{displayName}</p>
                <p className="text-sm text-outsail-gray-600">{displayEmail}</p>
                <Badge variant={ROLE_BADGE_VARIANTS[displayRole] ?? 'outline'} className="mt-1 text-xs capitalize">
                  {ROLE_LABELS[displayRole] ?? displayRole}
                </Badge>
              </div>
            </div>
            <div className="border-t border-outsail-gray-200 pt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-outsail-gray-600 mb-0.5">Email</p>
                <p className="text-outsail-slate font-medium">{displayEmail}</p>
              </div>
              <div>
                <p className="text-xs text-outsail-gray-600 mb-0.5">Role</p>
                <p className="text-outsail-slate font-medium capitalize">{ROLE_LABELS[displayRole] ?? displayRole}</p>
              </div>
              <div>
                <p className="text-xs text-outsail-gray-600 mb-0.5">Authentication</p>
                <p className="text-outsail-slate font-medium">Magic Link + Password</p>
              </div>
              <div>
                <p className="text-xs text-outsail-gray-600 mb-0.5">Session</p>
                <p className="text-outsail-slate font-medium">30-day rolling</p>
              </div>
            </div>
          </div>

          {/* Password */}
          {(currentRole === 'admin' || currentRole === 'advisor') && (
            <div className="bg-white rounded-xl border border-outsail-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-outsail-navy">Password</h2>
                  <p className="text-xs text-outsail-gray-600 mt-0.5">Update your password for direct sign-in</p>
                </div>
                <Link href="/dashboard/settings/change-password"
                  className="flex items-center gap-1.5 text-xs text-outsail-teal hover:text-outsail-teal/80 font-medium"
                >
                  Change password <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Logo upload (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-outsail-gray-200 p-6">
              <h2 className="text-sm font-semibold text-outsail-navy mb-1">Company Logo</h2>
              <p className="text-xs text-outsail-gray-600 mb-4">
                Displayed in the sidebar header for advisors and clients. PNG or SVG, max 2 MB.
              </p>
              <div className="flex items-start gap-5">
                {/* Preview */}
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-outsail-gray-200 flex items-center justify-center bg-outsail-gray-50 flex-shrink-0 overflow-hidden">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Logo preview" className="w-full h-full object-contain p-2" />
                  ) : (
                    <span className="text-2xl font-bold" style={{ color: '#4277c7' }}>OS</span>
                  )}
                </div>

                {/* Controls */}
                <div className="flex-1 space-y-3">
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => logoFileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 border border-outsail-gray-200 rounded-md text-sm text-outsail-gray-600 hover:border-outsail-navy transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {logo ? 'Replace Logo' : 'Upload Logo'}
                    </button>
                    {logo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={logoSaving}
                        className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                    {logo && logo !== currentLogo && (
                      <button
                        type="button"
                        onClick={() => saveLogo(logo)}
                        disabled={logoSaving}
                        className="px-4 py-2 bg-outsail-teal text-white rounded-md text-sm font-medium hover:bg-outsail-teal/90 disabled:opacity-50 transition-colors"
                      >
                        {logoSaving ? 'Saving…' : 'Save Logo'}
                      </button>
                    )}
                  </div>
                  {logoMsg && (
                    <p className={`text-xs ${logoMsg.startsWith('✓') ? 'text-outsail-teal' : 'text-red-600'}`}>
                      {logoMsg}
                    </p>
                  )}
                  <p className="text-xs text-outsail-gray-600">
                    Default: &ldquo;OutSail&rdquo; text in <span className="font-mono">#4277c7</span> when no logo uploaded.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROJECTS TAB (admin only) ── */}
      {activeTab === 'projects' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-outsail-gray-600">{filteredProjects.length} of {projects.length} projects</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-outsail-gray-200 p-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search by company…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className={`${inputClass} flex-1 min-w-48`}
              />
              <select
                value={projectStatusFilter}
                onChange={(e) => setProjectStatusFilter(e.target.value)}
                className={`${inputClass}`}
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
              <select
                value={projectAdvisorFilter}
                onChange={(e) => setProjectAdvisorFilter(e.target.value)}
                className={`${inputClass}`}
              >
                <option value="">All Advisors</option>
                {advisorOptions.map((a) => (
                  <option key={a.email} value={a.email}>{a.name ?? a.email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-outsail-gray-200 overflow-hidden">
            {filteredProjects.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-outsail-gray-600">No projects found.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-outsail-gray-50 border-b border-outsail-gray-200">
                  <tr>
                    {[
                      { col: 'client_company_name', label: 'Company' },
                      { col: 'advisor_name', label: 'Advisor' },
                      { col: 'status', label: 'Status' },
                      { col: 'tier', label: 'Tier' },
                      { col: 'updated_at', label: 'Last Activity' },
                    ].map(({ col, label }) => (
                      <th key={col} className="text-left px-4 py-3 text-label text-outsail-gray-600">
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className="flex items-center gap-1 hover:text-outsail-navy transition-colors"
                        >
                          {label}
                          <ArrowUpDown className={`w-3 h-3 ${projectSort.col === col ? 'text-outsail-teal' : 'text-outsail-gray-200'}`} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outsail-gray-200">
                  {filteredProjects.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-outsail-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-outsail-navy">{p.client_company_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-outsail-slate">{p.advisor_name ?? p.advisor_email ?? '—'}</p>
                        {p.advisor_name && p.advisor_email && (
                          <p className="text-xs text-outsail-gray-600">{p.advisor_email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.status ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[p.status] ?? 'bg-outsail-gray-50 text-outsail-gray-600 border-outsail-gray-200'}`}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-outsail-slate">
                        {p.tier ? (TIER_LABELS[p.tier] ?? p.tier) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-outsail-gray-600">
                        {formatDate(p.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── USERS TAB (admin only) ── */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          {/* Invite advisor */}
          <div className="bg-white rounded-xl border border-outsail-gray-200 p-6">
            <h2 className="text-sm font-semibold text-outsail-navy mb-1">Invite Advisor</h2>
            <p className="text-xs text-outsail-gray-600 mb-4">Creates an advisor account and sends login instructions via email.</p>
            <form onSubmit={handleInvite} className="flex gap-2 flex-wrap">
              <input
                type="text" placeholder="Name (optional)" value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                disabled={inviting}
                className={`${inputClass} w-40`}
              />
              <input
                type="email" placeholder="Email address" value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess(null) }}
                disabled={inviting} required
                className={`${inputClass} flex-1 min-w-48`}
              />
              <button type="submit" disabled={inviting || !inviteEmail.trim()}
                className="h-9 px-4 rounded-md bg-outsail-teal text-white text-sm font-medium hover:bg-outsail-teal/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Invite
              </button>
            </form>
            {inviteError && <p className="mt-2 text-xs text-red-600">{inviteError}</p>}
            {inviteSuccess && (
              <div className="mt-2 p-3 bg-outsail-teal/5 border border-outsail-teal/20 rounded-md">
                <p className="text-xs text-outsail-teal font-medium">{inviteSuccess}</p>
                <p className="text-xs text-outsail-gray-600 mt-0.5">Share this with the advisor — they&apos;ll be prompted to change it on first login.</p>
              </div>
            )}
          </div>

          {/* User list */}
          <div className="bg-white rounded-xl border border-outsail-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-outsail-gray-200">
              <h2 className="text-sm font-semibold text-outsail-navy">All Users ({users.length})</h2>
            </div>
            <div className="divide-y divide-outsail-gray-200">
              {users.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-outsail-gray-600">No users found.</div>
              )}
              {users.map((user) => {
                const isInactive = user.is_active === false
                return (
                  <div key={user.id} className={`px-6 py-3 flex items-center gap-3 ${isInactive ? 'opacity-60' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-outsail-gray-100 flex items-center justify-center text-xs font-bold text-outsail-gray-600 flex-shrink-0">
                      {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-outsail-navy truncate">
                        {user.name ?? user.email}
                        {isInactive && <span className="ml-2 text-xs text-outsail-gray-600">(deactivated)</span>}
                      </p>
                      {user.name && <p className="text-xs text-outsail-gray-600 truncate">{user.email}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {user.must_change_password && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          Must change pw
                        </span>
                      )}

                      {/* Resend invite */}
                      {user.id !== currentUserId && (user.role === 'advisor' || user.role === 'admin') && !isInactive && (
                        <div>
                          <button
                            type="button"
                            disabled={resendingId === user.id}
                            onClick={() => handleResendInvite(user.id)}
                            className="text-xs text-outsail-blue hover:underline disabled:opacity-50"
                          >
                            {resendingId === user.id ? 'Sending…' : 'Resend invite'}
                          </button>
                          {resendResult[user.id] && (
                            <p className="text-xs text-outsail-teal mt-0.5">{resendResult[user.id]}</p>
                          )}
                        </div>
                      )}

                      {/* Role select */}
                      {user.id === currentUserId ? (
                        <Badge variant={ROLE_BADGE_VARIANTS[user.role] ?? 'outline'} className="text-xs capitalize">
                          {ROLE_LABELS[user.role] ?? user.role} (you)
                        </Badge>
                      ) : (
                        <div className="relative">
                          {changingRole === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-outsail-gray-600" />
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={isInactive}
                              className="text-xs border border-outsail-gray-200 rounded-md px-2 py-1 bg-white text-outsail-slate focus:outline-none focus:ring-2 focus:ring-outsail-teal/30 disabled:opacity-50"
                            >
                              <option value="admin">Admin</option>
                              <option value="advisor">Advisor</option>
                              <option value="client">Client</option>
                            </select>
                          )}
                        </div>
                      )}

                      {/* Deactivate / reactivate */}
                      {user.id !== currentUserId && (
                        <button
                          type="button"
                          disabled={togglingActive === user.id}
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          className={`text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${
                            isInactive
                              ? 'border-outsail-teal text-outsail-teal hover:bg-outsail-teal/5'
                              : 'border-outsail-coral text-outsail-coral hover:bg-outsail-coral/5'
                          }`}
                        >
                          {togglingActive === user.id
                            ? '…'
                            : isInactive ? 'Reactivate' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── VENDORS TAB (admin only) ── */}
      {activeTab === 'vendors' && isAdmin && (
        <div className="bg-white rounded-xl border border-outsail-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-outsail-navy">Vendor Management</h2>
          </div>
          <p className="text-xs text-outsail-gray-600 mb-4">
            Manage the vendor database — logos, colors, categories, and active status.
          </p>
          <Link href="/dashboard/settings/vendors"
            className="inline-flex items-center gap-2 px-4 py-2 bg-outsail-teal text-white text-sm font-medium rounded-md hover:bg-outsail-teal/90 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Open Vendor Manager
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

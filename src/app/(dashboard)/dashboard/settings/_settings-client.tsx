'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, Shield, ChevronRight, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  must_change_password: boolean | null
  created_at: string | null
}

interface SettingsClientProps {
  currentUserId: string
  currentRole: string
  displayEmail: string
  displayName: string
  displayRole: string
  initials: string
  users: UserRow[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', advisor: 'Advisor', client: 'Client', vendor: 'Vendor',
}

const ROLE_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  admin: 'default', advisor: 'secondary', client: 'outline', vendor: 'outline',
}

export function SettingsClient({
  currentUserId, currentRole, displayEmail, displayName, displayRole, initials, users: initialUsers,
}: SettingsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'vendors'>('general')
  const [users, setUsers] = useState<UserRow[]>(initialUsers)

  // Invite form
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Role change
  const [changingRole, setChangingRole] = useState<string | null>(null)

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
      // Refresh users list
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

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'users' as const, label: 'Users', adminOnly: true },
    { id: 'vendors' as const, label: 'Vendors', adminOnly: true },
  ]

  const inputClass = "h-9 px-3 rounded-md border border-outsail-gray-200 bg-white text-sm text-outsail-slate placeholder:text-outsail-gray-600 focus:outline-none focus:ring-2 focus:ring-outsail-teal focus:border-transparent disabled:opacity-50"

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-header-lg text-outsail-navy">Settings</h1>
        <p className="text-body text-outsail-gray-600 mt-1">Manage your account and application preferences.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-outsail-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            if (tab.adminOnly && currentRole !== 'admin') return null
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

      {/* General Tab */}
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

          {/* Password section */}
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
        </div>
      )}

      {/* Users Tab (admin only) */}
      {activeTab === 'users' && currentRole === 'admin' && (
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
                className="h-9 px-4 rounded-md bg-outsail-teal text-white text-sm font-medium hover:bg-outsail-teal/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
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
              <h2 className="text-sm font-semibold text-outsail-navy">All Users</h2>
            </div>
            <div className="divide-y divide-outsail-gray-200">
              {users.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-outsail-gray-600">No users found.</div>
              )}
              {users.map((user) => (
                <div key={user.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-outsail-gray-100 flex items-center justify-center text-xs font-bold text-outsail-gray-600 flex-shrink-0">
                    {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-outsail-navy truncate">{user.name ?? user.email}</p>
                    {user.name && <p className="text-xs text-outsail-gray-600 truncate">{user.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {user.must_change_password && (
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        Must change pw
                      </span>
                    )}
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
                            className="text-xs border border-outsail-gray-200 rounded-md px-2 py-1 bg-white text-outsail-slate focus:outline-none focus:ring-2 focus:ring-outsail-teal/30"
                          >
                            <option value="admin">Admin</option>
                            <option value="advisor">Advisor</option>
                            <option value="client">Client</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vendors Tab (admin only) */}
      {activeTab === 'vendors' && currentRole === 'admin' && (
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

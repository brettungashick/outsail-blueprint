'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPassword || undefined, newPassword }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to update password.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full h-10 px-3 rounded-md border border-outsail-gray-200 bg-white text-sm text-outsail-slate placeholder:text-outsail-gray-600 focus:outline-none focus:ring-2 focus:ring-outsail-teal focus:border-transparent disabled:opacity-50 transition-shadow"

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-header-lg text-outsail-navy">Change Password</h1>
        <p className="text-body text-outsail-gray-600 mt-1">Set a new password for your account.</p>
      </div>

      <div className="bg-white rounded-xl border border-outsail-gray-200 p-6">
        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-outsail-teal/10 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-outsail-teal" />
            </div>
            <p className="text-sm font-medium text-outsail-navy">Password updated successfully!</p>
            <p className="text-xs text-outsail-gray-600 mt-1">Redirecting to dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label text-outsail-slate mb-1.5">Current password</label>
              <input
                type="password" autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Leave blank if this is a first-time setup"
                disabled={saving}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-label text-outsail-slate mb-1.5">New password</label>
              <input
                type="password" autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={saving}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-label text-outsail-slate mb-1.5">Confirm new password</label>
              <input
                type="password" autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                disabled={saving}
                className={inputClass}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">{error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving || !newPassword || !confirm}
                className="flex-1 h-10 rounded-md bg-outsail-teal text-white text-sm font-medium hover:bg-outsail-teal/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Update Password'}
              </button>
              <button type="button" onClick={() => router.back()} disabled={saving}
                className="px-4 h-10 rounded-md border border-outsail-gray-200 text-outsail-gray-600 text-sm hover:border-outsail-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

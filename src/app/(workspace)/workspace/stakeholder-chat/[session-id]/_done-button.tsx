'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function StakeholderDoneButton({
  sessionId,
  projectId,
}: {
  sessionId: string
  projectId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDone() {
    setLoading(true)
    try {
      await fetch('/api/workspace/complete-discovery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, project_id: projectId }),
      })
      setDone(true)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (done) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-outsail-teal-light rounded-card border border-outsail-teal/20">
      <p className="text-sm text-outsail-teal-dark font-medium">
        Finished sharing your input?
      </p>
      <button
        onClick={() => void handleDone()}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-1.5 bg-outsail-teal text-white text-sm font-medium rounded-lg hover:bg-outsail-teal-dark disabled:opacity-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        {loading ? 'Finishing up…' : "I'm done — submit my responses"}
      </button>
    </div>
  )
}

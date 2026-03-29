'use client'

import React, { useState } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'

type State = 'idle' | 'loading' | 'success' | 'error'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Check for error param from failed verify redirects
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'invalid_token') {
      setErrorMessage('Your sign-in link has expired or is invalid. Please request a new one.')
      setState('error')
    } else if (err === 'missing_token') {
      setErrorMessage('The sign-in link is missing a token. Please request a new one.')
      setState('error')
    } else if (err === 'server_error') {
      setErrorMessage('A server error occurred. Please try again.')
      setState('error')
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return

    setState('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      setState('success')
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-outsail-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-outsail-teal flex items-center justify-center">
              <span className="text-white font-bold text-sm">OS</span>
            </div>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: '#1D9E75' }}
            >
              OutSail Blueprint
            </span>
          </div>
          <p className="text-xs text-outsail-gray-600 mt-1">
            AI-powered HR tech discovery platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-card-lg border border-outsail-gray-200 shadow-sm p-8">
          {state === 'success' ? (
            <SuccessState email={email} onBack={() => setState('idle')} />
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-header-md text-outsail-navy mb-1">
                  Welcome back
                </h1>
                <p className="text-body text-outsail-gray-600">
                  Enter your email to receive a sign-in link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-label text-outsail-slate mb-1.5"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (state === 'error') {
                        setState('idle')
                        setErrorMessage('')
                      }
                    }}
                    placeholder="you@company.com"
                    disabled={state === 'loading'}
                    className="w-full h-10 px-3 rounded-md border border-outsail-gray-200 bg-white text-body text-outsail-slate placeholder:text-outsail-gray-600 focus:outline-none focus:ring-2 focus:ring-outsail-teal focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                    required
                  />
                </div>

                {state === 'error' && errorMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200">
                    <span className="text-outsail-red text-xs mt-0.5">⚠</span>
                    <p className="text-xs text-outsail-red">{errorMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={state === 'loading' || !email.trim()}
                  className="w-full h-10 rounded-md font-medium text-sm text-white transition-colors focus:outline-none focus:ring-2 focus:ring-outsail-teal focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#1D9E75' }}
                  onMouseEnter={(e) => {
                    if (state !== 'loading') {
                      e.currentTarget.style.backgroundColor = '#0F6E56'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1D9E75'
                  }}
                >
                  {state === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send Magic Link
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-outsail-gray-600 text-center mt-5">
                No password required. We&apos;ll email you a secure sign-in link.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-outsail-gray-600 mt-6">
          &copy; {new Date().getFullYear()} OutSail. All rights reserved.
        </p>
      </div>
    </div>
  )
}

function SuccessState({
  email,
  onBack,
}: {
  email: string
  onBack: () => void
}) {
  return (
    <div className="text-center py-2">
      <div className="flex justify-center mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#E1F5EE' }}
        >
          <CheckCircle2 className="w-7 h-7" style={{ color: '#1D9E75' }} />
        </div>
      </div>

      <h2 className="text-header-sm text-outsail-navy mb-2">Check your email</h2>
      <p className="text-body text-outsail-gray-600 mb-1">
        We&apos;ve sent a sign-in link to
      </p>
      <p className="text-body font-medium text-outsail-slate mb-5 break-all">
        {email}
      </p>
      <p className="text-xs text-outsail-gray-600 mb-6">
        The link expires in 15 minutes. Check your spam folder if you
        don&apos;t see it.
      </p>

      <button
        onClick={onBack}
        className="text-sm font-medium transition-colors"
        style={{ color: '#1D9E75' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#0F6E56'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#1D9E75'
        }}
      >
        Use a different email
      </button>
    </div>
  )
}

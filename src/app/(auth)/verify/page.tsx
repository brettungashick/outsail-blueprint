'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'

type VerifyState = 'verifying' | 'error'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<VerifyState>('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setErrorMessage('No verification token found in the URL.')
      setState('error')
      return
    }

    router.push(`/api/auth/verify?token=${encodeURIComponent(token)}`)
  }, [searchParams, router])

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-outsail-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: '#1D9E75' }}
            >
              OutSail Blueprint
            </span>
          </div>

          <div className="bg-white rounded-card-lg border border-outsail-gray-200 shadow-sm p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-outsail-red" />
              </div>
            </div>
            <h2 className="text-header-sm text-outsail-navy mb-2">
              Verification failed
            </h2>
            <p className="text-body text-outsail-gray-600 mb-6">{errorMessage}</p>
            <a
              href="/login"
              className="inline-flex items-center justify-center h-10 px-5 rounded-md text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#1D9E75' }}
            >
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-outsail-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: '#1D9E75' }}
          >
            OutSail Blueprint
          </span>
        </div>

        <div className="bg-white rounded-card-lg border border-outsail-gray-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#E1F5EE' }}
            >
              <Loader2
                className="w-7 h-7 animate-spin"
                style={{ color: '#1D9E75' }}
              />
            </div>
          </div>
          <h2 className="text-header-sm text-outsail-navy mb-2">
            Verifying your link
          </h2>
          <p className="text-body text-outsail-gray-600">
            Please wait while we sign you in...
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-outsail-gray-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#1D9E75' }} />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}

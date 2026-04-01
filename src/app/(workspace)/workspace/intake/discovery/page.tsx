import Link from 'next/link'
import { IntakeStepper } from '@/components/workspace/intake-stepper'

const INTAKE_STEPS = ['Company Profile', 'Tech Stack', 'Requirements', 'Processes', 'Review']

export default function DiscoveryPage() {
  return (
    <div className="space-y-8">
      <IntakeStepper currentStep={3} steps={INTAKE_STEPS} />

      <div>
        <h1 className="text-header-lg text-outsail-navy">Discovery Chat</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          In-depth discovery conversation with your OutSail advisor.
        </p>
      </div>

      <div className="outsail-card flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-outsail-teal/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-outsail-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <div>
          <h2 className="text-header-sm text-outsail-navy">Discovery Chat — Coming Soon</h2>
          <p className="text-body text-outsail-gray-600 mt-1 max-w-sm">
            Your advisor will guide you through a structured discovery session to understand your HR requirements in depth.
          </p>
        </div>
      </div>

      <div>
        <Link
          href="/workspace/intake/tech-stack"
          className="inline-flex items-center gap-2 text-sm text-outsail-gray-600 hover:text-outsail-navy transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tech Stack
        </Link>
      </div>
    </div>
  )
}

'use client'

interface IntakeStepperProps {
  currentStep: number
  steps: string[]
}

export function IntakeStepper({ currentStep, steps }: IntakeStepperProps) {
  return (
    <div className="w-full">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isFuture = stepNumber > currentStep
          const isLast = index === steps.length - 1

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isCompleted
                      ? 'bg-outsail-teal text-white'
                      : isCurrent
                      ? 'border-2 border-outsail-teal text-outsail-teal bg-white'
                      : 'border-2 border-outsail-gray-200 text-outsail-gray-600 bg-white'
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isCompleted || isCurrent
                      ? 'text-outsail-navy'
                      : 'text-outsail-gray-600'
                  }`}
                >
                  {step}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 ${
                    isCompleted ? 'bg-outsail-teal' : 'bg-outsail-gray-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

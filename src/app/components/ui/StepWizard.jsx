import React from 'react'
import { Check } from 'lucide-react'

export default function StepWizard({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => {
        const isCompleted = i < currentStep
        const isActive    = i === currentStep
        const isLast      = i === steps.length - 1

        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5">
              {/* Circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: isCompleted
                    ? 'var(--accent-primary)'
                    : isActive
                    ? 'var(--accent-bg)'
                    : 'var(--glass1)',
                  border: isCompleted
                    ? '2px solid var(--accent-primary)'
                    : isActive
                    ? '2px solid var(--accent-primary)'
                    : '2px solid var(--glass-border)',
                  boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none',
                }}
              >
                {isCompleted
                  ? <Check size={14} className="text-white" />
                  : (
                    <span style={{
                      fontSize:   12,
                      fontWeight: 600,
                      color:      isActive ? 'var(--text-accent)' : 'var(--text-muted)',
                    }}>
                      {i + 1}
                    </span>
                  )
                }
              </div>

              {/* Label */}
              <span style={{
                fontSize:    10,
                whiteSpace:  'nowrap',
                fontWeight:  isActive ? 600 : 400,
                color:       isActive
                  ? 'var(--text-accent)'
                  : isCompleted
                  ? 'var(--text-secondary)'
                  : 'var(--text-muted)',
              }}>
                {step}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className="flex-1 h-px mx-2 mb-5"
                style={{
                  background: i < currentStep
                    ? 'var(--accent-primary)'
                    : 'var(--glass-border)',
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
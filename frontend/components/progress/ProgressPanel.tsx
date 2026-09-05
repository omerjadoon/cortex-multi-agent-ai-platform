'use client'
import { useState } from 'react'
import { useChatStore } from '@/store/chat'
import { StepCard } from './StepCard'
import { StepDetailModal } from './StepDetailModal'
import type { Step } from '@/types'

export function ProgressPanel() {
  const { steps, isStreaming } = useChatStore()
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const activeSteps = steps.filter((s) => s.status !== 'pending')

  return (
    <aside className="w-72 xl:w-80 flex-shrink-0 bg-slate-900 border-l border-slate-700 flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 ${isStreaming ? 'bg-amber-500 cnc-pulse' : 'bg-slate-600'}`} />
            <h2 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">Agent Pipeline</h2>
          </div>
          <span className={`text-xs font-mono ${isStreaming ? 'text-amber-500' : 'text-slate-600'}`}>
            {isStreaming ? 'RUNNING' : 'IDLE'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {activeSteps.length === 0 ? (
          <p className="text-xs font-mono text-slate-600 text-center mt-8 uppercase tracking-wider">
            Awaiting input...
          </p>
        ) : (
          activeSteps.map((step) => (
            <StepCard
              key={step.name}
              step={step}
              onClick={() => setSelectedStep(step)}
            />
          ))
        )}
      </div>

      {/* All steps checklist */}
      <div className="border-t border-slate-700 p-3">
        <p className="text-xs font-mono text-slate-600 mb-2 uppercase tracking-widest">Pipeline Steps</p>
        <div className="space-y-1">
          {steps.map((step) => (
            <div
              key={step.name}
              onClick={() => step.status !== 'pending' && setSelectedStep(step)}
              className={`flex items-center justify-between gap-2 text-xs py-0.5 px-1 rounded transition-colors ${
                step.status !== 'pending' ? 'cursor-pointer hover:bg-slate-800' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono ${
                  step.status === 'done' ? 'text-emerald-400' :
                  step.status === 'running' ? 'text-amber-400' :
                  step.status === 'waiting' ? 'text-cyan-400' :
                  step.status === 'failed' ? 'text-red-400' : 'text-slate-700'
                }`}>
                  {step.status === 'done' ? '[✓]' : step.status === 'running' ? '[>]' : step.status === 'waiting' ? '[?]' : step.status === 'failed' ? '[✗]' : '[ ]'}
                </span>
                <span className={`font-mono ${step.status === 'pending' ? 'text-slate-700' : 'text-slate-300'}`}>
                  {step.label}
                </span>
              </div>
              {step.status !== 'pending' && (
                <span className="text-[10px] font-mono text-slate-500 hover:text-amber-400">
                  INSPECT
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Inspector */}
      <StepDetailModal
        step={selectedStep}
        onClose={() => setSelectedStep(null)}
      />
    </aside>
  )
}

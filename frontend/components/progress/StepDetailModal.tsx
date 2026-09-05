'use client'
import { useState, useEffect } from 'react'
import type { Step } from '@/types'

interface Props {
  step: Step | null
  onClose: () => void
}

export function StepDetailModal({ step, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!step) return null

  const handleCopy = () => {
    if (!step.detail) return
    navigator.clipboard.writeText(step.detail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isCode = step.name === 'codegen' || step.name === 'testgen' || step.detail?.includes('def ') || step.detail?.includes('import ')
  const isTestRun = step.name === 'testrun'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500" />
            <div>
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest block">Agent Pipeline Trace</span>
              <h3 className="text-sm font-mono font-bold text-slate-100 uppercase tracking-wider">{step.label}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono px-2 py-0.5 border uppercase ${
              step.status === 'done' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-700/50' :
              step.status === 'running' ? 'bg-amber-950/40 text-amber-400 border-amber-700/50 cnc-pulse' :
              step.status === 'failed' ? 'bg-red-950/40 text-red-400 border-red-700/50' :
              'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              STATUS: {step.status}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/60 font-mono text-xs text-slate-300 leading-relaxed">
          {step.detail ? (
            <div>
              <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                <span className="text-slate-500 text-[10px] uppercase tracking-widest">INTERMEDIATE STEP OUTPUT</span>
                <button
                  onClick={handleCopy}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono uppercase tracking-wider px-2 py-0.5 border border-cyan-900/40 hover:border-cyan-700 transition-colors"
                >
                  {copied ? '[COPIED]' : '[COPY OUTPUT]'}
                </button>
              </div>

              {isCode ? (
                <pre className="p-3 bg-slate-900 border border-slate-800 text-amber-300 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                  <code>{step.detail}</code>
                </pre>
              ) : isTestRun ? (
                <pre className="p-3 bg-slate-900 border border-slate-800 text-cyan-300 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                  <code>{step.detail}</code>
                </pre>
              ) : (
                <div className="p-3 bg-slate-900/80 border border-slate-800 text-slate-200 whitespace-pre-wrap font-mono text-xs">
                  {step.detail}
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-600 uppercase tracking-wider text-center py-8">
              No detailed payload captured for this step.
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center text-[10px] font-mono text-slate-600 uppercase">
          <span>STEP_ID: {step.name}</span>
          <span>PRESS ESC TO CLOSE</span>
        </div>
      </div>
    </div>
  )
}

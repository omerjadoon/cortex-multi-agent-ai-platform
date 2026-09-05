import type { Step, StepStatus } from "@/types"

interface Props {
  step: Step
  onClick?: () => void
}

const statusIcon: Record<StepStatus, React.ReactNode> = {
  pending: (
    <span className="w-4 h-4 border border-slate-600 inline-block flex-shrink-0"> </span>
  ),
  running: (
    <svg className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  ),
  done: (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  failed: (
    <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ),
  waiting: (
    <svg className="w-4 h-4 text-cyan-400 cnc-pulse flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="square" strokeLinejoin="miter" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const statusStyle: Record<StepStatus, string> = {
  pending: "bg-slate-900/40 border-slate-700/50",
  running: "bg-amber-950/20 border-amber-600/40 border-l-2 border-l-amber-500 hover:border-amber-400",
  done: "bg-emerald-950/20 border-emerald-700/30 border-l-2 border-l-emerald-500 hover:border-emerald-400",
  failed: "bg-red-950/20 border-red-700/40 border-l-2 border-l-red-500 hover:border-red-400",
  waiting: "bg-cyan-950/30 border-cyan-600/50 border-l-2 border-l-cyan-400 hover:border-cyan-300",
}

export function StepCard({ step, onClick }: Props) {
  if (step.status === "pending") return null

  return (
    <div
      onClick={onClick}
      className={`group flex items-center justify-between px-3 py-2 border cursor-pointer transition-all duration-200 ${statusStyle[step.status]}`}
      title="Click to view intermediate step output"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="mt-0.5">{statusIcon[step.status]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-mono font-medium text-slate-200 uppercase tracking-wide group-hover:text-amber-400 transition-colors">
              {step.label}
            </p>
          </div>
          {step.detail && (
            <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate group-hover:text-slate-400 transition-colors">
              {step.detail}
            </p>
          )}
        </div>
      </div>

      <div className="opacity-40 group-hover:opacity-100 text-slate-400 group-hover:text-amber-400 text-xs font-mono transition-opacity ml-2">
        [VIEW]
      </div>
    </div>
  )
}

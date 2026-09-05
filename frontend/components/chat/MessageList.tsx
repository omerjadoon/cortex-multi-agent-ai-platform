'use client'
import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import { useSSEChat } from '@/lib/sse'
import { MessageBubble } from './MessageBubble'

interface ExampleCard {
  title: string
  tag: string
  badge: string
  difficulty: 'EASY' | 'DIFFICULT'
  prompt: string
  description: string
  icon: JSX.Element
  borderColor: string
  hoverBorder: string
  accentColor: string
}

const EXAMPLES: ExampleCard[] = [
  // --- KNOWLEDGE BASE (RAG) EXAMPLES ---
  {
    title: 'hyperMILL Overview & Features',
    tag: 'KNOWLEDGE BASE',
    badge: 'RAG EASY',
    difficulty: 'EASY',
    prompt: 'What is hyperMILL CAM software and what are its main features and CAD integrations?',
    description: 'Searches vector DB for core hyperMILL capabilities, CAD compatibility, and module features.',
    borderColor: 'border-cyan-900/50',
    hoverBorder: 'hover:border-cyan-500/80 hover:bg-cyan-950/20',
    accentColor: 'text-cyan-400',
    icon: (
      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Virtual Machining & 5-Axis Collision',
    tag: 'KNOWLEDGE BASE',
    badge: 'RAG ADVANCED',
    difficulty: 'DIFFICULT',
    prompt: 'Explain hyperMILL Virtual Machining, G-code simulation, and how its NC Optimizer avoids axis limit collisions in 5-axis milling.',
    description: 'Deep hybrid search across Virtual Machining Center, digital twin simulation, and post-processor docs.',
    borderColor: 'border-cyan-900/50',
    hoverBorder: 'hover:border-cyan-400 hover:bg-cyan-950/30',
    accentColor: 'text-cyan-300',
    icon: (
      <svg className="w-4 h-4 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.596 15.12a2 2 0 00-1.022.547l-1.4 1.4a2 2 0 00.586 3.414l2.12.707a8 8 0 005.064-.093l.353-.118a8 8 0 015.064-.093l2.12-.707a2 2 0 00.586-3.414l-1.4-1.4z" />
      </svg>
    ),
  },

  // --- PYTHON CODE GENERATION EXAMPLES ---
  {
    title: 'CNC Tool List Parser',
    tag: 'PYTHON CODE',
    badge: 'CODE EASY',
    difficulty: 'EASY',
    prompt: 'Write a Python script to parse CNC tool list text file into structured JSON format with unit tests.',
    description: 'Generates clean string parsing functions, error handling, and pytest suite.',
    borderColor: 'border-amber-900/50',
    hoverBorder: 'hover:border-amber-500/80 hover:bg-amber-950/20',
    accentColor: 'text-amber-400',
    icon: (
      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    title: '3D Bounding Box Mesh Analyzer',
    tag: 'PYTHON CODE',
    badge: 'CODE HARD',
    difficulty: 'DIFFICULT',
    prompt: 'Generate an optimized Python 3D bounding box & volume calculator for STL mesh vertex arrays with full pytest coverage.',
    description: 'Multi-agent pipeline: planning, 3D geometric math algorithm, pyflakes check, and automated unit testing.',
    borderColor: 'border-amber-900/50',
    hoverBorder: 'hover:border-amber-400 hover:bg-amber-950/30',
    accentColor: 'text-amber-300',
    icon: (
      <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },

  // --- CNC G-CODE & INDUSTRIAL CAM EXAMPLES ---
  {
    title: 'Standard 3-Axis Square Pocket Milling',
    tag: 'CAD / CAM',
    badge: 'CNC EASY',
    difficulty: 'EASY',
    prompt: 'Write a G-code script for milling a 50mm x 50mm square pocket at 5mm depth on a 3-axis CNC router.',
    description: 'Generates G-code toolpath with spindle controls (M03), coolant (M08), feed rates (F), and retracts.',
    borderColor: 'border-emerald-900/50',
    hoverBorder: 'hover:border-emerald-500/80 hover:bg-emerald-950/20',
    accentColor: 'text-emerald-400',
    icon: (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
  {
    title: 'High-Speed Trochoidal Milling G-Code',
    tag: 'CAD / CAM',
    badge: 'CNC HARD',
    difficulty: 'DIFFICULT',
    prompt: 'Generate an advanced G-code script for high-speed trochoidal slot milling with spiral plunge, arc leads, and subroutines.',
    description: 'Creates high-efficiency HPC machining toolpath with constant engagement angle and subprograms.',
    borderColor: 'border-emerald-900/50',
    hoverBorder: 'hover:border-emerald-400 hover:bg-emerald-950/30',
    accentColor: 'text-emerald-300',
    icon: (
      <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="square" strokeLinejoin="miter" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
]

export function MessageList() {
  const { messages, isStreaming } = useChatStore()
  const { sendMessage } = useSSEChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {messages.length === 0 ? (
        <div className="h-full max-w-5xl mx-auto flex flex-col justify-center py-4">
          {/* Header section */}
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="square" strokeLinejoin="miter" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-mono text-amber-500 uppercase tracking-widest px-2.5 py-0.5 border border-amber-500/30 bg-amber-950/20">
              SYS:READY · SELECT A BENCHMARK PROMPT
            </span>
            <h2 className="text-xl font-bold text-slate-100 mt-2 tracking-tight">
              Cortex CAD/CAM & Agent Playground
            </h2>
            <p className="text-xs font-mono text-slate-500 max-w-lg mx-auto mt-1">
              Select an Easy or Difficult prompt below to query our ingested Cortex knowledge base or run the multi-agent execution pipeline.
            </p>
          </div>

          {/* Example cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.title}
                onClick={() => !isStreaming && sendMessage(ex.prompt)}
                disabled={isStreaming}
                className={`group relative text-left bg-slate-900/90 border ${ex.borderColor} ${ex.hoverBorder} p-4 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="p-1 bg-slate-800 border border-slate-700 group-hover:border-slate-600 transition-colors">
                        {ex.icon}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        {ex.tag}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 border uppercase tracking-wider ${
                        ex.difficulty === 'EASY'
                          ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-400'
                          : 'border-rose-700/40 bg-rose-950/30 text-rose-400'
                      }`}>
                        {ex.difficulty}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 border border-slate-700 bg-slate-800 ${ex.accentColor} uppercase tracking-wider`}>
                        {ex.badge}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-200 group-hover:text-slate-100 mb-1 transition-colors flex items-center justify-between">
                    <span>{ex.title}</span>
                    <span className="text-xs text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all font-mono">
                      →
                    </span>
                  </h3>

                  <p className="text-[11px] font-mono text-slate-400 group-hover:text-slate-300 transition-colors line-clamp-2 mb-3 leading-snug">
                    "{ex.prompt}"
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-600">
                  <span className="truncate pr-2">{ex.description}</span>
                  <span className="text-[9px] uppercase text-amber-500/90 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">
                    RUN ↵
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map((msg, i) => {
          const question =
            msg.role === 'assistant'
              ? messages.slice(0, i).findLast((m) => m.role === 'user')?.content
              : undefined
          return <MessageBubble key={msg.id} message={msg} question={question} />
        })
      )}
      {isStreaming && (
        <div className="flex justify-start mb-3">
          <div className="bg-slate-900 border border-slate-700 border-l-2 border-l-cyan-500 px-4 py-3 ml-8">
            <div className="flex gap-1 items-center">
              <span className="text-xs font-mono text-slate-600 mr-2">PROCESSING</span>
              <span className="w-1.5 h-1.5 bg-cyan-500 cnc-pulse [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-cyan-500 cnc-pulse [animation-delay:200ms]" />
              <span className="w-1.5 h-1.5 bg-cyan-500 cnc-pulse [animation-delay:400ms]" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

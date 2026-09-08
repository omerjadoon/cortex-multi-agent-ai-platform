'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { api } from '@/lib/api'
import { useChatStore } from '@/store/chat'
import type { Message } from '@/types'

interface Props {
  message: Message
  question?: string
}

/** Detect if a message was blocked by guardrails based on content prefix or blocked flag */
function isBlockedMessage(message: Message): boolean {
  return (
    message.blocked === true ||
    message.content.startsWith('[Security Alert]') ||
    message.content.startsWith('I cannot fulfill this request because it contains instructions that attempt to bypass')
  )
}

/** Extract human-readable reason from a blocked message */
function extractBlockReason(content: string): string {
  const stripped = content
    .replace(/^\[Security Alert\]\s*/i, '')
    .replace(/^I cannot fulfill this request because it contains instructions that attempt to bypass safety guidelines, override system prompts, or generate inappropriate content\.?/i, '')
    .trim()
  return stripped || 'This request was blocked by the security guardrail.'
}

export function MessageBubble({ message, question }: Props) {
  const isUser = message.role === 'user'
  const setMessageFeedback = useChatStore((s) => s.setMessageFeedback)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleFeedback = async (rating: 1 | -1) => {
    if (message.feedback || submitting) return
    if (!question) return
    setSubmitting(true)
    try {
      await api.submitFeedback(rating, question, message.content)
      setMessageFeedback(message.id, rating)
      showToast(rating === 1 ? 'LOGGED: GOOD EXAMPLE' : 'FLAGGED: SENT TO ADMIN')
    } catch {
      showToast('SUBMIT FAILED')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Security guardrail block card ──────────────────────────────────────────
  if (!isUser && isBlockedMessage(message)) {
    const reason = extractBlockReason(message.content)
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[80%]">
          <div className="flex items-start gap-2">
            {/* Shield icon avatar */}
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 bg-red-900/40 border border-red-500/50 text-red-400">
              <ShieldIcon />
            </div>

            {/* Warning card */}
            <div className="border border-red-500/40 bg-red-950/30 px-4 py-3 border-l-2 border-l-red-500">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-2">
                <WarningIcon />
                <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-widest">
                  Security Guardrail Triggered
                </span>
              </div>

              {/* Reason */}
              {reason && (
                <p className="text-xs font-mono text-red-300/80 leading-relaxed">
                  {reason}
                </p>
              )}

              {/* Footer badge */}
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/40 border border-red-700/50 text-[10px] font-mono text-red-400 uppercase tracking-wider">
                  <BlockIcon />
                  Request Denied
                </span>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-2 mt-1 pl-8">
            <p className="text-xs font-mono text-slate-700" suppressHydrationWarning>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal message bubble ──────────────────────────────────────────────────
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar + bubble */}
        <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`w-6 h-6 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 ${
            isUser
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
              : 'bg-cyan-900/30 border border-cyan-700/40 text-cyan-400'
          }`}>
            {isUser ? 'OP' : 'AI'}
          </div>

          <div className={`px-4 py-3 border ${
            isUser
              ? 'bg-slate-800 border-slate-600 text-slate-100 border-l-2 border-l-amber-500'
              : 'bg-slate-900 border-slate-700 text-slate-100 border-l-2 border-l-cyan-500'
          }`}>
            {isUser ? (
              <p className="text-sm font-mono whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="text-sm prose prose-invert prose-sm max-w-none prose-p:font-mono prose-p:text-slate-200 prose-strong:text-slate-100 prose-code:text-amber-400 prose-code:bg-slate-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Code blocks */}
        {message.code && (
          <div className={`mt-2 ${isUser ? 'pr-8' : 'pl-8'}`}>
            <CodeBlock code={message.code} label="Generated Script" />
          </div>
        )}
        {message.testCode && (
          <div className={`mt-2 ${isUser ? 'pr-8' : 'pl-8'}`}>
            <CodeBlock code={message.testCode} label="Test Cases" />
          </div>
        )}

        {/* Footer: timestamp + feedback */}
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end pr-8' : 'pl-8'}`}>
          <p className="text-xs font-mono text-slate-700" suppressHydrationWarning>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>

          {!isUser && question && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFeedback(1)}
                disabled={!!message.feedback || submitting}
                title="Good example"
                className={`p-1 transition-colors ${
                  message.feedback === 1
                    ? 'text-emerald-400'
                    : message.feedback
                    ? 'text-slate-700 cursor-default'
                    : 'text-slate-600 hover:text-emerald-400'
                }`}
              >
                <ThumbUpIcon />
              </button>
              <button
                onClick={() => handleFeedback(-1)}
                disabled={!!message.feedback || submitting}
                title="Flag for review"
                className={`p-1 transition-colors ${
                  message.feedback === -1
                    ? 'text-red-400'
                    : message.feedback
                    ? 'text-slate-700 cursor-default'
                    : 'text-slate-600 hover:text-red-400'
                }`}
              >
                <ThumbDownIcon />
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="pl-8 mt-1">
            <span className="text-xs font-mono text-amber-500">{toast}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function BlockIcon() {
  return (
    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  )
}

function ThumbUpIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
  )
}

function ThumbDownIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
    </svg>
  )
}

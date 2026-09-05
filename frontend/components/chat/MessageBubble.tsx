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

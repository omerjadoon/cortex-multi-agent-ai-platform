'use client'
import { useState, useRef, useCallback } from 'react'
import { useChatStore } from '@/store/chat'
import { useSSEChat } from '@/lib/sse'

export function ChatInput() {
  const [value, setValue] = useState('')
  const { isStreaming } = useChatStore()
  const { sendMessage } = useSSEChat()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    const msg = value.trim()
    if (!msg || isStreaming) return
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessage(msg)
  }, [value, isStreaming, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  return (
    <div className="border-t border-slate-700 px-4 py-3 bg-slate-900">
      <div className="flex gap-2 items-end">
        <div className={`flex-1 bg-slate-800 border overflow-hidden transition-all ${isStreaming ? 'border-amber-500/40' : 'border-slate-600 focus-within:border-amber-500'}`}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
            placeholder={isStreaming ? 'AGENT PROCESSING...' : 'Enter query or describe operation...'}
            className="w-full bg-transparent px-3 py-3 text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none disabled:opacity-50 font-mono"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!value.trim() || isStreaming}
          className="w-10 h-10 flex items-center justify-center bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {isStreaming ? (
            <svg className="w-4 h-4 text-slate-950 cnc-pulse" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-950" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs font-mono text-slate-700 mt-2">
        ENTER: SEND  ·  SHIFT+ENTER: NEW LINE
      </p>
    </div>
  )
}

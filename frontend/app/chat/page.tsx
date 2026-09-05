'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { ProgressPanel } from '@/components/progress/ProgressPanel'
import { RoleBadge } from '@/components/ui/badge'
import { auth } from '@/lib/auth'
import { useChatStore } from '@/store/chat'
import type { User } from '@/types'

export default function ChatPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const { activeThreadId, threads } = useChatStore()

  const activeThread = threads.find((t) => t.id === activeThreadId)

  useEffect(() => {
    setMounted(true)
    const currentUser = auth.getUser() as User | null
    if (!auth.isAuthenticated() || !currentUser) {
      router.replace('/login')
    } else {
      setUser(currentUser)
    }
  }, [router])

  const handleLogout = () => {
    auth.clear()
    router.replace('/login')
  }

  if (!mounted || !user) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500">
        LOADING SYSTEM...
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="square" strokeLinejoin="miter" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-100 tracking-tight">Cortex</span>
            <span className="text-xs font-mono text-slate-600 uppercase tracking-widest hidden sm:inline">/ CNC-CAD INTELLIGENCE</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500 hidden sm:inline">{user.email}</span>
          <RoleBadge role={user.role} />
          {user.role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              className="text-xs font-mono text-slate-400 hover:text-amber-400 px-2 py-1 border border-slate-700 hover:border-amber-500/40 transition-colors uppercase tracking-wider"
            >
              ADMIN
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs font-mono text-slate-500 hover:text-slate-200 px-2 py-1 border border-slate-700 hover:border-slate-500 transition-colors uppercase tracking-wider"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-1 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-emerald-400" />
          <span className="text-xs font-mono text-slate-600">SYS:ONLINE</span>
        </div>
        <span className="text-slate-800 text-xs">|</span>
        <span className="text-xs font-mono text-slate-600">RAG:READY</span>
        <span className="text-slate-800 text-xs">|</span>
        <span className="text-xs font-mono text-slate-600">
          THREAD: {activeThread ? activeThread.title.toUpperCase() : 'NEW CHAT'}
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Thread Sidebar */}
        <ThreadSidebar />

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <MessageList />
          <ChatInput />
        </div>

        {/* Progress panel */}
        <ProgressPanel />
      </div>
    </div>
  )
}

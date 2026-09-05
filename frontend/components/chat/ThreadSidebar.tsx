'use client'

import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/chat'

export function ThreadSidebar() {
  const {
    threads,
    activeThreadId,
    activeThreadSummary,
    sidebarOpen,
    isLoadingThreads,
    fetchThreads,
    selectThread,
    createNewThread,
    deleteThread,
    renameThread,
    setSidebarOpen,
  } = useChatStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [filterText, setFilterText] = useState('')

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  const handleCreateNew = async () => {
    await selectThread(null)
  }

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditingTitle(currentTitle)
  }

  const handleSaveRename = async (id: string) => {
    if (editingTitle.trim()) {
      await renameThread(id, editingTitle.trim())
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this chat thread and its history?')) {
      await deleteThread(id)
    }
  }

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(filterText.toLowerCase())
  )

  if (!sidebarOpen) {
    return (
      <div className="w-12 border-r border-slate-800 bg-slate-950 flex flex-col items-center py-3 gap-4 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          title="Expand Chat Threads"
          className="w-8 h-8 rounded bg-slate-900 border border-slate-700 hover:border-amber-500/60 flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={handleCreateNew}
          title="New Chat Thread"
          className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/40 hover:border-amber-400 flex items-center justify-center text-amber-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <div className="flex-1" />

        <div className="text-[10px] font-mono text-slate-600 [writing-mode:vertical-lr] rotate-180 uppercase tracking-widest">
          THREADS ({threads.length})
        </div>
      </div>
    )
  }

  return (
    <aside className="w-72 border-r border-slate-800 bg-slate-950 flex flex-col flex-shrink-0 font-sans relative">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            CHAT THREADS
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700">
            {threads.length}
          </span>
        </div>

        <button
          onClick={() => setSidebarOpen(false)}
          title="Collapse Sidebar"
          className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-slate-800/80">
        <button
          onClick={handleCreateNew}
          className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-400 font-mono text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 group"
        >
          <svg className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4v16m8-8H4" />
          </svg>
          <span>START NEW CHAT</span>
        </button>

        {/* Filter Input */}
        {threads.length > 3 && (
          <div className="mt-2 relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter threads..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/50 text-slate-300 text-xs px-2.5 py-1.5 focus:outline-none font-mono placeholder:text-slate-600"
            />
          </div>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoadingThreads && threads.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-slate-600">
            LOADING THREADS...
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono text-slate-600">
            {filterText ? 'NO MATCHING THREADS' : 'NO CHAT THREADS YET'}
          </div>
        ) : (
          filteredThreads.map((t) => {
            const isActive = activeThreadId === t.id
            const isEditing = editingId === t.id

            return (
              <div
                key={t.id}
                onClick={() => selectThread(t.id)}
                className={`group relative p-2.5 rounded border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 border-amber-500/60 shadow-sm shadow-amber-950/20'
                    : 'bg-slate-950/40 hover:bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveRename(t.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(t.id)}
                        autoFocus
                        className="w-full bg-slate-950 border border-amber-500/60 text-slate-100 text-xs px-1.5 py-0.5 font-mono focus:outline-none"
                      />
                    ) : (
                      <h4
                        className={`text-xs font-semibold truncate ${
                          isActive ? 'text-amber-400' : 'text-slate-300 group-hover:text-slate-100'
                        }`}
                      >
                        {t.title}
                      </h4>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-slate-500">
                        {t.message_count} msg{t.message_count !== 1 ? 's' : ''}
                      </span>

                      {t.summary && (
                        <span
                          title="Contains long chat history summary"
                          className="text-[9px] font-mono px-1 py-0.2 bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 uppercase tracking-wider"
                        >
                          SUMMARIZED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                    <button
                      onClick={(e) => handleStartRename(t.id, t.title, e)}
                      title="Rename Thread"
                      className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => handleDelete(t.id, e)}
                      title="Delete Thread"
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer / Active Thread Summary Bar */}
      {activeThreadSummary && (
        <div className="p-2.5 border-t border-slate-800 bg-slate-900/90 text-xs font-mono">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
              CONTEXT SUMMARY
            </span>
            <button
              onClick={() => setShowSummaryModal(true)}
              className="text-[9px] text-slate-400 hover:text-cyan-300 underline"
            >
              VIEW FULL
            </button>
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight italic">
            "{activeThreadSummary}"
          </p>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && activeThreadSummary && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-lg w-full p-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700 mb-3">
              <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="square" strokeLinejoin="miter" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                THREAD CONTEXT SUMMARY
              </span>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="text-slate-400 hover:text-slate-100 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-slate-300 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800 bg-slate-950 p-3">
              {activeThreadSummary}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSummaryModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

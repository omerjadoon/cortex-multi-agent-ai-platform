import { create } from 'zustand'
import type { Message, Step, StepName, StepStatus, ChatStore, ChatThread } from '@/types'
import { auth } from '@/lib/auth'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const INITIAL_STEPS: Step[] = [
  { name: 'routing', label: 'Classify intent', status: 'pending' },
  { name: 'bm25', label: 'BM25 keyword search', status: 'pending' },
  { name: 'semantic', label: 'Semantic search', status: 'pending' },
  { name: 'merging', label: 'Merge & re-rank results', status: 'pending' },
  { name: 'answering', label: 'Generate answer', status: 'pending' },
  { name: 'planning', label: 'Plan script structure', status: 'pending' },
  { name: 'clarification', label: 'Human-in-the-Loop Clarification', status: 'pending' },
  { name: 'codegen', label: 'Generate Python script', status: 'pending' },
  { name: 'validating', label: 'Validate syntax', status: 'pending' },
  { name: 'testgen', label: 'Generate test cases', status: 'pending' },
  { name: 'testrun', label: 'Run tests', status: 'pending' },
  { name: 'fixing', label: 'Fix errors & retry', status: 'pending' },
  { name: 'done', label: 'Complete', status: 'pending' },
]

let msgId = 0

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  steps: INITIAL_STEPS.map((s) => ({ ...s })),
  isStreaming: false,
  currentSessionId: null,

  threads: [],
  activeThreadId: null,
  activeThreadSummary: null,
  sidebarOpen: true,
  isLoadingThreads: false,

  setThreads: (threads) => set({ threads }),
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setMessages: (messages) => set({ messages }),

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: String(++msgId), timestamp: new Date() },
      ],
    })),

  updateLastMessage: (content, code, testCode) =>
    set((state) => {
      const msgs = [...state.messages]
      const last = msgs.findLastIndex((m) => m.role === 'assistant')
      if (last !== -1) msgs[last] = { ...msgs[last], content, code, testCode }
      return { messages: msgs }
    }),

  setMessageFeedback: (id, rating) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, feedback: rating } : m)),
    })),

  setStepStatus: (step, status, detail) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.name === step ? { ...s, status, detail } : s
      ),
    })),

  resetSteps: () => set({ steps: INITIAL_STEPS.map((s) => ({ ...s })) }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  // --- THREAD ACTIONS ---

  fetchThreads: async () => {
    const token = auth.getToken()
    if (!token) return
    set({ isLoadingThreads: true })
    try {
      const res = await fetch(`${BASE}/chat/threads`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: ChatThread[] = await res.json()
        set({ threads: data })
      }
    } catch (err) {
      console.error('Failed to fetch chat threads:', err)
    } finally {
      set({ isLoadingThreads: false })
    }
  },

  selectThread: async (threadId) => {
    const token = auth.getToken()
    if (!threadId) {
      set({
        activeThreadId: null,
        activeThreadSummary: null,
        messages: [],
        steps: INITIAL_STEPS.map((s) => ({ ...s })),
      })
      return
    }

    if (!token) return
    try {
      const res = await fetch(`${BASE}/chat/threads/${threadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const formattedMsgs: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          code: m.code || undefined,
          testCode: m.testCode || undefined,
          timestamp: new Date(m.timestamp),
        }))
        set({
          activeThreadId: data.id,
          activeThreadSummary: data.summary || null,
          messages: formattedMsgs,
          steps: INITIAL_STEPS.map((s) => ({ ...s })),
        })
      }
    } catch (err) {
      console.error(`Failed to load thread ${threadId}:`, err)
    }
  },

  createNewThread: async (title) => {
    const token = auth.getToken()
    if (!token) return null
    try {
      const res = await fetch(`${BASE}/chat/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title || 'New Chat' }),
      })
      if (res.ok) {
        const newThread: ChatThread = await res.json()
        set((state) => ({
          threads: [newThread, ...state.threads],
          activeThreadId: newThread.id,
          activeThreadSummary: null,
          messages: [],
          steps: INITIAL_STEPS.map((s) => ({ ...s })),
        }))
        return newThread.id
      }
    } catch (err) {
      console.error('Failed to create new thread:', err)
    }
    return null
  },

  deleteThread: async (threadId) => {
    const token = auth.getToken()
    if (!token) return
    try {
      const res = await fetch(`${BASE}/chat/threads/${threadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        set((state) => {
          const updatedThreads = state.threads.filter((t) => t.id !== threadId)
          const isDeletingActive = state.activeThreadId === threadId
          return {
            threads: updatedThreads,
            activeThreadId: isDeletingActive ? null : state.activeThreadId,
            activeThreadSummary: isDeletingActive ? null : state.activeThreadSummary,
            messages: isDeletingActive ? [] : state.messages,
            steps: isDeletingActive ? INITIAL_STEPS.map((s) => ({ ...s })) : state.steps,
          }
        })
      }
    } catch (err) {
      console.error(`Failed to delete thread ${threadId}:`, err)
    }
  },

  renameThread: async (threadId, newTitle) => {
    const token = auth.getToken()
    if (!token) return
    try {
      const res = await fetch(`${BASE}/chat/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      })
      if (res.ok) {
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === threadId ? { ...t, title: newTitle } : t
          ),
        }))
      }
    } catch (err) {
      console.error(`Failed to rename thread ${threadId}:`, err)
    }
  },
}))

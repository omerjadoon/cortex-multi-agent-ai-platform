export type Role = 'admin' | 'developer' | 'viewer'

export interface User {
  id: string
  email: string
  role: Role
  allowed_collections: string[]
}

export type StepName =
  | 'routing'
  | 'bm25'
  | 'semantic'
  | 'merging'
  | 'answering'
  | 'planning'
  | 'clarification'
  | 'codegen'
  | 'validating'
  | 'testgen'
  | 'testrun'
  | 'fixing'
  | 'done'

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'waiting'

export interface ProgressEvent {
  step: StepName
  status: StepStatus
  detail?: string
  payload?: string
  retry_count?: number
}

export interface Step {
  name: StepName
  label: string
  status: StepStatus
  detail?: string
}

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  code?: string
  testCode?: string
  timestamp: Date
  feedback?: 1 | -1   // 1 = thumbs up, -1 = thumbs down
  blocked?: boolean   // true if blocked by guardrails / security check
}

export interface SecurityIncident {
  id: string
  user_email: string | null
  prompt: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  reviewed: boolean
  created_at: string
}

export interface FeedbackItem {
  id: string
  rating: 1 | -1
  question: string
  answer: string
  status: 'pending' | 'ingested' | 'dismissed'
  collection: string | null
  created_at: string
  user_email: string
}

export interface ChatThread {
  id: string
  title: string
  summary?: string | null
  created_at: string
  updated_at: string
  message_count: number
}

export interface ChatStore {
  messages: Message[]
  steps: Step[]
  isStreaming: boolean
  currentSessionId: string | null
  threads: ChatThread[]
  activeThreadId: string | null
  activeThreadSummary: string | null
  sidebarOpen: boolean
  isLoadingThreads: boolean

  setThreads: (threads: ChatThread[]) => void
  setActiveThreadId: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMessages: (messages: Message[]) => void

  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void
  updateLastMessage: (content: string, code?: string, testCode?: string) => void
  setMessageFeedback: (id: string, rating: 1 | -1) => void
  setStepStatus: (step: StepName, status: StepStatus, detail?: string) => void
  resetSteps: () => void
  setStreaming: (v: boolean) => void

  fetchThreads: () => Promise<void>
  selectThread: (threadId: string | null) => Promise<void>
  createNewThread: (title?: string) => Promise<string | null>
  deleteThread: (threadId: string) => Promise<void>
  renameThread: (threadId: string, newTitle: string) => Promise<void>
}


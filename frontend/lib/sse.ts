'use client'
import { useChatStore } from '@/store/chat'
import { auth } from '@/lib/auth'
import type { ProgressEvent, StepName } from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function useSSEChat() {
  const {
    addMessage,
    updateLastMessage,
    setStepStatus,
    resetSteps,
    setStreaming,
    setActiveThreadId,
    fetchThreads,
  } = useChatStore()

  const sendMessage = async (message: string) => {
    const token = auth.getToken()
    if (!token) return

    const { activeThreadId } = useChatStore.getState()

    resetSteps()
    setStreaming(true)
    addMessage({ role: 'user', content: message })
    addMessage({ role: 'assistant', content: '...' })

    try {
      const response = await fetch(`${BASE}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          thread_id: activeThreadId || undefined,
        }),
      })

      if (!response.ok || !response.body) {
        updateLastMessage('Error: could not reach the server.')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalAnswer = ''
      let finalCode = ''
      let finalTestCode = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event: ProgressEvent & {
              payload?: string
              code?: string
              test_code?: string
              thread_id?: string
            } = JSON.parse(raw)

            if (event.thread_id && !useChatStore.getState().activeThreadId) {
              setActiveThreadId(event.thread_id)
            }

            if (event.step) {
              setStepStatus(event.step as StepName, event.status, event.detail)
            }

            if (event.step === 'done') {
              finalAnswer = event.payload || ''
              finalCode = event.code || ''
              finalTestCode = event.test_code || ''
              if (event.thread_id) {
                setActiveThreadId(event.thread_id)
              }
            }
          } catch {
            // malformed SSE line
          }
        }
      }

      updateLastMessage(finalAnswer || 'Done.', finalCode, finalTestCode)
      // Refresh threads list in sidebar
      await fetchThreads()
    } catch (err) {
      updateLastMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setStreaming(false)
    }
  }

  return { sendMessage }
}

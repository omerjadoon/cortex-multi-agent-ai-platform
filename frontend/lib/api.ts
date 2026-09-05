import type { Role, User, FeedbackItem } from '@/types'
import { auth } from '@/lib/auth'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = auth.getToken()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extra }
}

export interface DocEntry {
  filename: string
  chunks: number
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; role: Role }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, role: Role = 'viewer') =>
    request<{ id: string; email: string; role: Role }>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    }),

  me: (token?: string) =>
    request<User>('/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || auth.getToken()}`,
      },
    }),

  // ── Users (admin) ─────────────────────────────────────────────────────────
  getUsers: () =>
    request<(User & { is_active: boolean })[]>('/auth/users', { headers: authHeaders() }),

  createUser: (email: string, password: string, role: Role = 'viewer', collections: string[] = []) =>
    request<{ id: string; email: string; role: Role }>('/auth/users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password, role, collections }),
    }),

  deleteUser: (userId: string) =>
    request<{ detail: string }>(`/auth/users/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),

  updateUserCollections: (userId: string, collections: string[]) =>
    request<{ user_id: string; collections: string[] }>(`/auth/users/${userId}/collections`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ collections }),
    }),

  // ── Collections ───────────────────────────────────────────────────────────
  getCollections: () =>
    request<{ collections: string[] }>('/collections/', { headers: authHeaders() })
      .then(r => r.collections),

  createCollection: (name: string) =>
    request<{ collection: string }>('/collections/', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    }),

  deleteCollection: (name: string) =>
    request<{ collection: string; status: string }>(`/collections/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),

  // ── Documents (knowledge base) ────────────────────────────────────────────
  getDocuments: (collection: string) =>
    request<{ collection: string; documents: DocEntry[] }>(
      `/collections/${encodeURIComponent(collection)}/documents`,
      { headers: authHeaders() }
    ).then(r => r.documents),

  deleteDocument: (collection: string, filename: string) =>
    request<{ status: string }>(
      `/collections/${encodeURIComponent(collection)}/documents?filename=${encodeURIComponent(filename)}`,
      { method: 'DELETE', headers: authHeaders() }
    ),

  updateDocument: (collection: string, filename: string, content: string) =>
    request<{ chunks: number; status: string }>(
      `/collections/${encodeURIComponent(collection)}/documents?filename=${encodeURIComponent(filename)}`,
      { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ content }) }
    ),

  // ── Feedback ──────────────────────────────────────────────────────────────
  submitFeedback: (rating: 1 | -1, question: string, answer: string) =>
    request<{ id: string; status: string }>('/feedback/', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ rating, question, answer }),
    }),

  getFeedback: (status: 'pending' | 'ingested' | 'dismissed' = 'pending') =>
    request<{ feedback: FeedbackItem[] }>(`/feedback/?status=${status}`, {
      headers: authHeaders(),
    }).then(r => r.feedback),

  ingestFeedback: (id: string, collection: string, question: string, answer: string) =>
    request<{ chunks: number; status: string }>(`/feedback/${id}/ingest`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ collection, question, answer }),
    }),

  dismissFeedback: (id: string) =>
    request<{ status: string }>(`/feedback/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),

  // ── Ingestion ─────────────────────────────────────────────────────────────
  ingest: async (file: File, collection: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('collection', collection)
    const token = auth.getToken()
    const res = await fetch(`${BASE}/chat/ingest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Ingest failed')
    }
    return res.json() as Promise<{ collection: string; filename: string; chunks: number }>
  },
}

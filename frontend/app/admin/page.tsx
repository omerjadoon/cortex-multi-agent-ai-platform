'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { User, FeedbackItem } from '@/types'
import type { DocEntry } from '@/lib/api'

type Tab = 'users' | 'kb' | 'ingest' | 'feedback'

function StatusBanner({ msg, onClear }: { msg: string; onClear: () => void }) {
  if (!msg) return null
  const isErr = msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')
  return (
    <div className={`flex items-center justify-between px-3 py-2 border text-xs font-mono mb-4 ${isErr ? 'border-red-700 bg-red-900/20 text-red-400' : 'border-emerald-700 bg-emerald-900/20 text-emerald-400'}`}>
      <span>{isErr ? '[ERR] ' : '[OK] '}{msg}</span>
      <button onClick={onClear} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

function InlineEditor({ initial, placeholder, onSave }: { initial: string; placeholder?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(initial)
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs font-mono text-cyan-500 hover:text-cyan-400 px-2 py-1 border border-transparent hover:border-cyan-700/40 transition-colors uppercase">
        EDIT
      </button>
    )
  }
  return (
    <div className="flex gap-1">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={placeholder}
        className="w-36 bg-slate-800 border border-slate-600 px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500 text-slate-200"
      />
      <button onClick={() => { onSave(val); setEditing(false) }} className="text-xs font-mono text-emerald-400 hover:text-emerald-300 px-1">✓</button>
      <button onClick={() => setEditing(false)} className="text-xs font-mono text-slate-600 hover:text-slate-400 px-1">✗</button>
    </div>
  )
}

function UsersTab({ onStatus }: { onStatus: (m: string) => void }) {
  const [users, setUsers] = useState<(User & { is_active: boolean })[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'viewer' | 'developer' | 'admin'>('viewer')
  const [newCollections, setNewCollections] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try { setUsers(await api.getUsers()) } catch (e: any) { onStatus(e.message) }
  }, [onStatus])

  useEffect(() => { load() }, [load])

  const handleUpdateCollections = async (userId: string, cols: string) => {
    try {
      const parsed = cols.split(',').map(c => c.trim()).filter(Boolean)
      await api.updateUserCollections(userId, parsed)
      onStatus('Collections updated')
      load()
    } catch (e: any) { onStatus(e.message) }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) return
    setCreating(true)
    try {
      const parsedCols = newCollections.split(',').map(c => c.trim()).filter(Boolean)
      await api.createUser(newEmail, newPassword, newRole, parsedCols)
      onStatus(`Operator "${newEmail}" created successfully.`)
      setNewEmail('')
      setNewPassword('')
      setNewRole('viewer')
      setNewCollections('')
      setShowCreate(false)
      load()
    } catch (err: any) {
      onStatus(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete operator "${email}"?`)) return
    try {
      await api.deleteUser(userId)
      onStatus(`User "${email}" deleted.`)
      load()
    } catch (err: any) {
      onStatus(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">Operator Registry</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
        >
          {showCreate ? 'CANCEL' : '+ ADD OPERATOR'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateUser} className="border border-slate-700 bg-slate-900 p-4 space-y-3 max-w-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">NEW OPERATOR PROFILES</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Email / Operator ID</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="user@cortex.ai"
                className="w-full bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Access Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Access Role</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="viewer">VIEWER</option>
                <option value="developer">DEVELOPER</option>
                <option value="admin">ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Initial Collections (Comma Sep)</label>
              <input
                type="text"
                value={newCollections}
                onChange={e => setNewCollections(e.target.value)}
                placeholder="cortex, docs"
                className="w-full bg-slate-800 border border-slate-600 px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 border border-slate-600 hover:border-slate-500 text-slate-400 text-xs font-mono uppercase"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-mono font-bold uppercase"
            >
              {creating ? 'CREATING...' : 'CREATE USER'}
            </button>
          </div>
        </form>
      )}

      <div className="border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              <th className="px-4 py-2.5 text-left text-xs font-mono text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-mono text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-mono text-slate-500 uppercase tracking-wider">Allowed Collections</th>
              <th className="px-4 py-2.5 text-left text-xs font-mono text-slate-500 uppercase tracking-wider">Edit</th>
              <th className="px-4 py-2.5 text-right text-xs font-mono text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const colStr = (u as any).allowed_collections?.join(', ') ?? ''
              return (
                <tr key={u.id} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono px-2 py-0.5 border uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-amber-900/30 text-amber-400 border-amber-600/40' :
                      u.role === 'developer' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/40' :
                      'bg-slate-800 text-slate-500 border-slate-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{colStr || '—'}</td>
                  <td className="px-4 py-3">
                    <InlineEditor initial={colStr} placeholder="col1, col2" onSave={v => handleUpdateCollections(u.id, v)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      className="text-xs font-mono text-red-500 hover:text-red-400 px-2 py-1 border border-transparent hover:border-red-700/40 transition-colors uppercase"
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocumentRow({ doc, onDelete, onUpdate }: { doc: DocEntry; onDelete: () => void; onUpdate: (content: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [content, setContent] = useState('')

  const openEdit = () => {
    setContent('')
    setEditMode(true)
    setExpanded(true)
  }

  const handleSave = () => {
    if (!content.trim()) return
    onUpdate(content)
    setEditMode(false)
    setExpanded(false)
  }

  return (
    <div className="border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-4 bg-slate-600 flex-shrink-0" />
          <span className="text-xs font-mono text-slate-300 truncate">{doc.filename}</span>
          <span className="text-xs font-mono text-slate-600 flex-shrink-0">[{doc.chunks}]</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={openEdit} className="text-xs font-mono text-cyan-500 hover:text-cyan-400 px-2 py-1 border border-transparent hover:border-cyan-700/40 transition-colors uppercase">UPDATE</button>
          <button onClick={onDelete} className="text-xs font-mono text-red-500 hover:text-red-400 px-2 py-1 border border-transparent hover:border-red-700/40 transition-colors uppercase">DELETE</button>
          <button onClick={() => { setExpanded(v => !v); setEditMode(false) }} className="text-xs font-mono text-slate-600 hover:text-slate-300 px-2 py-1 transition-colors">{expanded ? '▲' : '▼'}</button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-700 px-3 py-3 bg-slate-900/50">
          {editMode ? (
            <div className="space-y-2">
              <p className="text-xs font-mono text-slate-600">Paste new content — replaces all existing chunks.</p>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                placeholder="New document content..."
                className="w-full bg-slate-800 border border-slate-600 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-y font-mono"
              />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={!content.trim()} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-mono font-bold uppercase transition-colors">SAVE</button>
                <button onClick={() => { setEditMode(false); setExpanded(false) }} className="px-4 py-1.5 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-200 text-xs font-mono uppercase transition-colors">CANCEL</button>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-slate-600">Click UPDATE to replace content, DELETE to remove entirely.</p>
          )}
        </div>
      )}
    </div>
  )
}

function KnowledgeBaseTab({ onStatus }: { onStatus: (m: string) => void }) {
  const [collections, setCollections] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [newCol, setNewCol] = useState('')
  const [creating, setCreating] = useState(false)

  const loadCollections = useCallback(async () => {
    try { setCollections(await api.getCollections()) } catch (e: any) { onStatus(e.message) }
  }, [onStatus])

  useEffect(() => { loadCollections() }, [loadCollections])

  const loadDocs = useCallback(async (col: string) => {
    setDocsLoading(true)
    try { setDocs(await api.getDocuments(col)) } catch (e: any) { onStatus(e.message) }
    finally { setDocsLoading(false) }
  }, [onStatus])

  const selectCollection = (col: string) => { setSelected(col); loadDocs(col) }

  const handleCreateCollection = async () => {
    if (!newCol.trim()) return
    setCreating(true)
    try {
      await api.createCollection(newCol.trim())
      onStatus(`Created collection "${newCol.trim()}"`)
      setNewCol('')
      await loadCollections()
    } catch (e: any) { onStatus(e.message) }
    finally { setCreating(false) }
  }

  const handleDeleteCollection = async (col: string) => {
    if (!confirm(`Delete entire collection "${col}"? This removes all documents.`)) return
    try {
      await api.deleteCollection(col)
      onStatus(`Deleted collection "${col}"`)
      if (selected === col) { setSelected(null); setDocs([]) }
      await loadCollections()
    } catch (e: any) { onStatus(e.message) }
  }

  const handleDeleteDoc = async (filename: string) => {
    if (!selected || !confirm(`Delete "${filename}" from "${selected}"?`)) return
    try {
      await api.deleteDocument(selected, filename)
      onStatus(`Deleted "${filename}"`)
      await loadDocs(selected)
    } catch (e: any) { onStatus(e.message) }
  }

  const handleUpdateDoc = async (filename: string, content: string) => {
    if (!selected) return
    try {
      const r = await api.updateDocument(selected, filename, content)
      onStatus(`Updated "${filename}" → ${r.chunks} chunks`)
      await loadDocs(selected)
    } catch (e: any) { onStatus(e.message) }
  }

  return (
    <div className="grid grid-cols-[240px_1fr] gap-4 min-h-[500px]">
      <div className="space-y-3">
        <div className="flex gap-1">
          <input
            value={newCol}
            onChange={e => setNewCol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
            placeholder="New collection..."
            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 text-slate-100 placeholder-slate-600"
          />
          <button
            onClick={handleCreateCollection}
            disabled={creating || !newCol.trim()}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-mono font-bold uppercase transition-colors"
          >+</button>
        </div>
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Collections</p>
        <div className="space-y-0.5">
          {collections.length === 0 && <p className="text-xs font-mono text-slate-700">No collections.</p>}
          {collections.map(col => (
            <div
              key={col}
              className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border ${
                selected === col
                  ? 'border-amber-500/40 bg-amber-900/10 text-amber-300'
                  : 'border-transparent hover:border-slate-600 hover:bg-slate-800 text-slate-400'
              }`}
              onClick={() => selectCollection(col)}
            >
              <span className="text-xs font-mono truncate">{col}</span>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteCollection(col) }}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 text-xs px-1 transition-opacity"
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-l border-slate-700 pl-4">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-700 text-xs font-mono uppercase tracking-wider">Select a collection</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">
                {selected} <span className="text-slate-600">({docs.length} files)</span>
              </h3>
              <button onClick={() => loadDocs(selected)} className="text-xs font-mono text-slate-600 hover:text-amber-400 transition-colors uppercase tracking-wider">↻ REFRESH</button>
            </div>
            {docsLoading ? (
              <p className="text-xs font-mono text-slate-600 cnc-pulse">Loading...</p>
            ) : docs.length === 0 ? (
              <p className="text-xs font-mono text-slate-700">No documents. Use Ingest tab to add files.</p>
            ) : (
              <div className="space-y-1">
                {docs.map(doc => (
                  <DocumentRow
                    key={doc.filename}
                    doc={doc}
                    onDelete={() => handleDeleteDoc(doc.filename)}
                    onUpdate={content => handleUpdateDoc(doc.filename, content)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IngestTab({ onStatus }: { onStatus: (m: string) => void }) {
  const [collections, setCollections] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [collection, setCollection] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.getCollections().then(setCollections).catch(() => {})
  }, [])

  const handleIngest = async () => {
    if (!file || !collection.trim()) { onStatus('Select a file and choose a collection'); return }
    setLoading(true)
    onStatus('Ingesting...')
    try {
      const r = await api.ingest(file, collection.trim())
      onStatus(`Ingested "${r.filename}" → ${r.chunks} chunks into "${r.collection}"`)
      setFile(null)
    } catch (e: any) { onStatus(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">Ingest Document</h2>
      <div className="border border-slate-700 p-6 space-y-4">
        <div>
          <label className="block text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Target Collection</label>
          <select
            value={collection}
            onChange={e => setCollection(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 text-slate-300 mb-2"
          >
            <option value="">— select collection —</option>
            {collections.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={collection}
            onChange={e => setCollection(e.target.value)}
            placeholder="Or type a new collection name"
            className="w-full bg-slate-800 border border-slate-600 px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 text-slate-300 placeholder-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Document (.txt or .md)</label>
          <label className="flex items-center gap-3 cursor-pointer bg-slate-800 border border-dashed border-slate-600 hover:border-amber-500/50 px-4 py-6 transition-colors">
            <svg className="w-5 h-5 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-xs font-mono text-slate-500">{file ? file.name : 'CLICK TO SELECT FILE'}</span>
            <input type="file" accept=".txt,.md" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <button
          onClick={handleIngest}
          disabled={loading || !file || !collection.trim()}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-mono font-bold uppercase tracking-widest transition-colors"
        >
          {loading ? 'INGESTING...' : 'INGEST DOCUMENT'}
        </button>
      </div>
    </div>
  )
}

function FeedbackCard({ item, collections, onStatus, onRefresh }: { item: FeedbackItem; collections: string[]; onStatus: (m: string) => void; onRefresh: () => void }) {
  const [question, setQuestion] = useState(item.question)
  const [answer, setAnswer] = useState(item.answer)
  const [collection, setCollection] = useState(collections[0] ?? '')
  const [busy, setBusy] = useState(false)

  const handleIngest = async () => {
    if (!collection.trim()) { onStatus('Select a collection first'); return }
    setBusy(true)
    try {
      const r = await api.ingestFeedback(item.id, collection, question, answer)
      onStatus(`Added to "${collection}" — ${r.chunks} chunks`)
      onRefresh()
    } catch (e: any) { onStatus(e.message) }
    finally { setBusy(false) }
  }

  const handleDismiss = async () => {
    setBusy(true)
    try { await api.dismissFeedback(item.id); onRefresh() }
    catch (e: any) { onStatus(e.message) }
    finally { setBusy(false) }
  }

  const ratingColor = item.rating === 1 ? 'text-emerald-400 border-emerald-700/40' : 'text-red-400 border-red-700/40'
  const ratingLabel = item.rating === 1 ? '[+] GOOD' : '[-] BAD'

  return (
    <div className="border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono px-1.5 py-0.5 border ${ratingColor}`}>{ratingLabel}</span>
          <span className="text-xs font-mono text-slate-600">{item.user_email}</span>
          <span className="text-xs font-mono text-slate-700">{new Date(item.created_at).toLocaleString()}</span>
        </div>
        {item.status === 'pending' && (
          <div className="flex items-center gap-2">
            <select
              value={collection}
              onChange={e => setCollection(e.target.value)}
              className="bg-slate-700 border border-slate-600 px-2 py-1 text-xs font-mono focus:outline-none focus:border-amber-500 text-slate-300"
            >
              <option value="">— collection —</option>
              {collections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleIngest} disabled={busy || !collection.trim()} className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-mono font-bold uppercase transition-colors">ADD TO KB</button>
            <button onClick={handleDismiss} disabled={busy} className="px-3 py-1 border border-slate-600 hover:border-slate-500 text-slate-500 hover:text-slate-300 text-xs font-mono uppercase transition-colors">DISMISS</button>
          </div>
        )}
        {item.status !== 'pending' && (
          <span className={`text-xs font-mono px-2 py-0.5 border uppercase tracking-wider ${item.status === 'ingested' ? 'border-emerald-700/40 text-emerald-500' : 'border-slate-700 text-slate-600'}`}>{item.status}</span>
        )}
      </div>
      <div className="p-3 space-y-3 bg-slate-900">
        <div className="space-y-1">
          <label className="text-xs font-mono text-slate-600 uppercase tracking-widest">Query</label>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={item.status !== 'pending'}
            rows={2}
            className="w-full bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 resize-none disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-mono text-slate-600 uppercase tracking-widest">Response</label>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={item.status !== 'pending'}
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 resize-y disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  )
}

function FeedbackTab({ onStatus }: { onStatus: (m: string) => void }) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<'pending' | 'ingested' | 'dismissed'>('pending')
  const [loading, setLoading] = useState(false)
  const [collections, setCollections] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fb, cols] = await Promise.all([api.getFeedback(filter), api.getCollections()])
      setItems(fb)
      setCollections(cols)
    } catch (e: any) { onStatus(e.message) }
    finally { setLoading(false) }
  }, [filter, onStatus])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">User Feedback</h2>
        <div className="flex gap-0 border border-slate-700">
          {(['pending', 'ingested', 'dismissed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors border-r border-slate-700 last:border-r-0 ${
                filter === s ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-200'
              }`}
            >{s}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-xs font-mono text-slate-600 cnc-pulse uppercase tracking-wider">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-xs font-mono text-slate-700 uppercase">No {filter} feedback items.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <FeedbackCard key={item.id} item={item} collections={collections} onStatus={onStatus} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('feedback')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const user = auth.getUser()
    if (!user || user.role !== 'admin') router.replace('/chat')
  }, [router])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feedback', label: 'FEEDBACK' },
    { id: 'kb', label: 'KNOWLEDGE BASE' },
    { id: 'ingest', label: 'INGEST' },
    { id: 'users', label: 'USERS' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-6 py-2.5 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/chat')} className="text-xs font-mono text-slate-500 hover:text-amber-400 transition-colors uppercase tracking-wider">
            ← BACK TO CHAT
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-amber-500" />
            <h1 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-widest">Admin Console</h1>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <StatusBanner msg={status} onClear={() => setStatus('')} />
        <div className="flex gap-0 border border-slate-700 mb-6 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-mono font-medium transition-colors border-r border-slate-700 last:border-r-0 ${
                tab === t.id ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >{t.label}</button>
          ))}
        </div>
        {tab === 'feedback' && <FeedbackTab onStatus={setStatus} />}
        {tab === 'kb' && <KnowledgeBaseTab onStatus={setStatus} />}
        {tab === 'ingest' && <IngestTab onStatus={setStatus} />}
        {tab === 'users' && <UsersTab onStatus={setStatus} />}
      </div>
    </div>
  )
}

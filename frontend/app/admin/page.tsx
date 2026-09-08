'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { User, FeedbackItem, SecurityIncident } from '@/types'
import type { DocEntry, ChunkEntry, SearchInspectResponse } from '@/lib/api'

type Tab = 'users' | 'kb' | 'inspector' | 'ingest' | 'feedback' | 'security'

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

function DocumentRow({ doc, collection, onDelete, onUpdate }: { doc: DocEntry; collection: string; onDelete: () => void; onUpdate: (content: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [viewChunks, setViewChunks] = useState(false)
  const [chunks, setChunks] = useState<ChunkEntry[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [content, setContent] = useState('')

  const openEdit = () => {
    setContent('')
    setEditMode(true)
    setExpanded(true)
    setViewChunks(false)
  }

  const handleSave = () => {
    if (!content.trim()) return
    onUpdate(content)
    setEditMode(false)
    setExpanded(false)
  }

  const toggleChunks = async () => {
    if (!viewChunks) {
      setLoadingChunks(true)
      try {
        const res = await api.getChunks(collection, doc.filename)
        setChunks(res.chunks)
      } catch (err: any) {
        console.error(err)
      } finally {
        setLoadingChunks(false)
      }
    }
    setViewChunks(!viewChunks)
    setEditMode(false)
    setExpanded(true)
  }

  return (
    <div className="border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-4 bg-slate-600 flex-shrink-0" />
          <span className="text-xs font-mono text-slate-300 truncate">{doc.filename}</span>
          <span className="text-xs font-mono text-amber-400/80 flex-shrink-0">[{doc.chunks} chunks]</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={toggleChunks} className="text-xs font-mono text-amber-400 hover:text-amber-300 px-2 py-1 border border-transparent hover:border-amber-700/40 transition-colors uppercase">
            {viewChunks ? 'HIDE CHUNKS' : 'VIEW CHUNKS'}
          </button>
          <button onClick={openEdit} className="text-xs font-mono text-cyan-500 hover:text-cyan-400 px-2 py-1 border border-transparent hover:border-cyan-700/40 transition-colors uppercase">UPDATE</button>
          <button onClick={onDelete} className="text-xs font-mono text-red-500 hover:text-red-400 px-2 py-1 border border-transparent hover:border-red-700/40 transition-colors uppercase">DELETE</button>
          <button onClick={() => { setExpanded(v => !v); setEditMode(false); setViewChunks(false) }} className="text-xs font-mono text-slate-600 hover:text-slate-300 px-2 py-1 transition-colors">{expanded ? '▲' : '▼'}</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700 px-3 py-3 bg-slate-900/50 space-y-3">
          {viewChunks && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase">
                  RAW CHUNKS ({chunks.length}) — Recursive Semantic Splitter (512 Chars Target)
                </span>
              </div>
              {loadingChunks ? (
                <p className="text-xs font-mono text-slate-500 cnc-pulse">Loading chunks from database...</p>
              ) : chunks.length === 0 ? (
                <p className="text-xs font-mono text-slate-600">No chunks found.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {chunks.map((c, idx) => (
                    <div key={c.id || idx} className="bg-slate-950 border border-slate-800 p-2.5 font-mono text-xs space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 border-b border-slate-800/60 pb-1">
                        <span className="text-amber-500 font-bold">CHUNK #{idx + 1}</span>
                        <span>{c.length} CHARACTERS</span>
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap text-[11px] leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {editMode && (
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
          )}

          {!viewChunks && !editMode && (
            <p className="text-xs font-mono text-slate-600">Click VIEW CHUNKS to inspect stored chunks, UPDATE to replace content, DELETE to remove.</p>
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
                    collection={selected}
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

function SearchInspectorTab({ onStatus }: { onStatus: (m: string) => void }) {
  const [collections, setCollections] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selectedCol, setSelectedCol] = useState<string>('')
  const [topK, setTopK] = useState<number>(5)
  const [inspectResult, setInspectResult] = useState<SearchInspectResponse | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    api.getCollections().then(setCollections).catch(() => {})
  }, [])

  const handleInspect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const colList = selectedCol ? [selectedCol] : []
      const res = await api.inspectSearch(query.trim(), colList, topK)
      setInspectResult(res)
      onStatus(`Retrieved top ${topK} chunks for query across all 3 pipeline stages`)
    } catch (err: any) {
      onStatus(err.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Strategy Banner */}
      <div className="border border-slate-700 bg-slate-900/80 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              Active Chunking Strategy & Retrieval Architecture
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-semibold uppercase">Recursive Semantic Splitter</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950 p-2.5 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Chunking Strategy</span>
            <span className="text-slate-200 font-semibold">{inspectResult?.chunking_strategy?.name || 'Recursive Hierarchical Semantic Chunking'}</span>
            <p className="text-[11px] text-slate-400 mt-1">Target: <strong className="text-amber-400">512 chars</strong> | Overlap: <strong className="text-amber-400">64 chars</strong></p>
          </div>
          <div className="bg-slate-950 p-2.5 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Semantic Vector Search</span>
            <span className="text-slate-200 font-semibold">{inspectResult?.chunking_strategy?.embedding_model || 'BAAI/bge-small-en-v1.5'}</span>
            <p className="text-[11px] text-slate-400 mt-1">384 Dimensions | {inspectResult?.chunking_strategy?.vector_store || 'Qdrant Vector Engine'}</p>
          </div>
          <div className="bg-slate-950 p-2.5 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Lexical Engine (BM25)</span>
            <span className="text-slate-200 font-semibold">{inspectResult?.chunking_strategy?.lexical_store || 'BM25 In-Memory Index'}</span>
            <p className="text-[11px] text-slate-400 mt-1">Exact keyword token frequency matching</p>
          </div>
          <div className="bg-slate-950 p-2.5 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Hybrid Reranker</span>
            <span className="text-slate-200 font-semibold">{inspectResult?.chunking_strategy?.reranker || 'Reciprocal Rank Fusion (RRF)'}</span>
            <p className="text-[11px] text-slate-400 mt-1">RRF (k=60) multi-stage candidate merger</p>
          </div>
        </div>
      </div>

      {/* Query Search Form */}
      <form onSubmit={handleInspect} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Enter search prompt (e.g. 'How does RBAC work in OpenMind?')"
          className="flex-1 bg-slate-900 border border-slate-700 px-4 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 placeholder-slate-600"
        />
        <select
          value={selectedCol}
          onChange={e => setSelectedCol(e.target.value)}
          className="bg-slate-900 border border-slate-700 px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500"
        >
          <option value="">All Collections</option>
          {collections.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={topK}
          onChange={e => setTopK(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 px-3 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500"
        >
          <option value={3}>Top 3</option>
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
        </select>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
        >
          {searching ? 'INSPECTING...' : 'INSPECT RETRIEVAL'}
        </button>
      </form>

      {/* 3-Column Inspection Output */}
      {inspectResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
            <span>QUERY: <strong className="text-amber-300 font-normal">"{inspectResult.query}"</strong></span>
            <span>SHOWING: <strong className="text-slate-200">Top {inspectResult.top_k} Chunks Per Stage</strong></span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Semantic Vector Search */}
            <div className="border border-cyan-800/40 bg-cyan-950/10 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-cyan-800/30 pb-2">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔮</span> Stage 1: Semantic Vector Search
                </span>
                <span className="text-[10px] font-mono bg-cyan-900/40 text-cyan-300 px-2 py-0.5 border border-cyan-700/40">Qdrant</span>
              </div>
              <div className="space-y-2">
                {inspectResult.semantic_chunks.length === 0 ? (
                  <p className="text-xs font-mono text-slate-600">No semantic matches found.</p>
                ) : (
                  inspectResult.semantic_chunks.map((chunk, idx) => (
                    <div key={idx} className="border border-slate-800 bg-slate-900 p-2.5 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                        <span className="text-cyan-400 font-bold">#{idx + 1} {chunk.filename || chunk.source || 'chunk'}</span>
                        {chunk.score && <span className="text-slate-500 text-[10px]">score: {Number(chunk.score).toFixed(3)}</span>}
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">{chunk.content || chunk.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: BM25 Lexical Keyword Search */}
            <div className="border border-amber-800/40 bg-amber-950/10 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-800/30 pb-2">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔍</span> Stage 2: Lexical BM25 Search
                </span>
                <span className="text-[10px] font-mono bg-amber-900/40 text-amber-300 px-2 py-0.5 border border-amber-700/40">In-Memory</span>
              </div>
              <div className="space-y-2">
                {inspectResult.bm25_chunks.length === 0 ? (
                  <p className="text-xs font-mono text-slate-600">No BM25 matches found.</p>
                ) : (
                  inspectResult.bm25_chunks.map((chunk, idx) => (
                    <div key={idx} className="border border-slate-800 bg-slate-900 p-2.5 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                        <span className="text-amber-400 font-bold">#{idx + 1} {chunk.filename || chunk.source || 'chunk'}</span>
                        {chunk.score && <span className="text-slate-500 text-[10px]">score: {Number(chunk.score).toFixed(3)}</span>}
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">{chunk.content || chunk.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: RRF Reranked Merged Output */}
            <div className="border border-emerald-800/40 bg-emerald-950/10 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-800/30 pb-2">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚡</span> Stage 3: RRF Reranked Merged
                </span>
                <span className="text-[10px] font-mono bg-emerald-900/40 text-emerald-300 px-2 py-0.5 border border-emerald-700/40">Final Prompt Context</span>
              </div>
              <div className="space-y-2">
                {inspectResult.reranked_chunks.length === 0 ? (
                  <p className="text-xs font-mono text-slate-600">No reranked chunks retrieved.</p>
                ) : (
                  inspectResult.reranked_chunks.map((chunk, idx) => (
                    <div key={idx} className="border border-emerald-950 bg-slate-900 p-2.5 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1">
                        <span className="text-emerald-400 font-bold">#{idx + 1} {chunk.filename || chunk.source || 'chunk'}</span>
                        <span className="text-emerald-400 text-[10px] font-bold">Passed to LLM</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed text-[11px] whitespace-pre-wrap">{chunk.content || chunk.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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

function SecurityTab({ onStatus }: { onStatus: (m: string) => void }) {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSecurityIncidents(filter === 'unreviewed' ? false : undefined)
      setIncidents(data)
    } catch (e: any) {
      onStatus(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter, onStatus])

  useEffect(() => { load() }, [load])

  const handleReview = async (id: string) => {
    try {
      await api.markIncidentReviewed(id)
      onStatus('Incident marked as reviewed.')
      load()
    } catch (e: any) {
      onStatus(e.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-red-400">FLAGGED PROMPTS & SECURITY AUDIT</h2>
          <p className="text-xs font-mono text-slate-500">Automated audit trail of prompt injection, system prompt extraction, and guardrail violations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unreviewed')}
            className={`px-3 py-1 text-xs font-mono border transition-colors ${
              filter === 'unreviewed' ? 'border-red-500 bg-red-950/40 text-red-400 font-bold' : 'border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
          >UNREVIEWED</button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-mono border transition-colors ${
              filter === 'all' ? 'border-amber-500 bg-amber-950/40 text-amber-400 font-bold' : 'border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
          >ALL LOGS</button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs font-mono text-slate-600 cnc-pulse uppercase tracking-wider">Loading security logs...</p>
      ) : incidents.length === 0 ? (
        <p className="text-xs font-mono text-slate-700 uppercase">No security incidents recorded.</p>
      ) : (
        <div className="space-y-3">
          {incidents.map((item) => (
            <div key={item.id} className={`p-4 border font-mono text-xs ${item.reviewed ? 'border-slate-800 bg-slate-900/50 opacity-75' : 'border-red-900/60 bg-red-950/20'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    item.severity === 'high' ? 'bg-red-900/50 text-red-400 border border-red-700/50' :
                    item.severity === 'medium' ? 'bg-amber-900/50 text-amber-400 border border-amber-700/50' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    [{item.severity}]
                  </span>
                  <span className="text-slate-400">{item.user_email || 'Anonymous User'}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                {!item.reviewed && (
                  <button
                    onClick={() => handleReview(item.id)}
                    className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-400 uppercase tracking-wider transition-colors"
                  >
                    MARK REVIEWED
                  </button>
                )}
              </div>
              <div className="mb-2 bg-slate-950 p-2 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase tracking-widest mb-1">Flagged Prompt:</span>
                <p className="text-slate-200 whitespace-pre-wrap">{item.prompt}</p>
              </div>
              <div className="text-red-300/90 text-[11px]">
                <span className="text-red-500 font-bold">REASON:</span> {item.reason}
              </div>
            </div>
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
    { id: 'security', label: 'SECURITY LOGS' },
    { id: 'kb', label: 'KNOWLEDGE BASE' },
    { id: 'inspector', label: 'RAG SEARCH INSPECTOR' },
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
        {tab === 'security' && <SecurityTab onStatus={setStatus} />}
        {tab === 'kb' && <KnowledgeBaseTab onStatus={setStatus} />}
        {tab === 'inspector' && <SearchInspectorTab onStatus={setStatus} />}
        {tab === 'ingest' && <IngestTab onStatus={setStatus} />}
        {tab === 'users' && <UsersTab onStatus={setStatus} />}
      </div>
    </div>
  )
}

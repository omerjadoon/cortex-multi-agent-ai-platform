'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { auth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await api.login(email, password)
        auth.setToken(res.access_token)
        const me = await api.me(res.access_token)
        auth.setUser(me)
        router.push('/chat')
      } else {
        await api.register(email, password)
        setMode('login')
        setError('Account created — please log in.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      {/* Corner decoration */}
      <div className="absolute top-0 left-0 w-32 h-32 border-r border-b border-slate-800 pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 border-l border-b border-slate-800 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-r border-t border-slate-800 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 border-l border-t border-slate-800 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Header bar */}
        <div className="flex items-center gap-3 mb-0 px-1">
          <div className="w-2 h-2 bg-amber-500" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">CORTEX — CNC/CAD INTELLIGENCE SYSTEM</span>
        </div>

        <div className="border border-slate-700 bg-slate-900 mt-2">
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              {mode === 'login' ? 'OPERATOR LOGIN' : 'REGISTER OPERATOR'}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-slate-600" />
              <div className="w-2 h-2 bg-slate-600" />
              <div className="w-2 h-2 bg-amber-500" />
            </div>
          </div>

          <div className="p-8">
            {/* Logo */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100 tracking-tight">Cortex AI</h1>
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Multi-Agent Intelligence Platform</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1 uppercase tracking-wider">Operator ID (Email)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-colors"
                  placeholder="operator@facility.com"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1 uppercase tracking-wider">Access Code</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className={`border px-3 py-2 text-xs font-mono ${error.includes('created') ? 'border-emerald-700 bg-emerald-900/20 text-emerald-400' : 'border-red-700 bg-red-900/20 text-red-400'}`}>
                  {error.includes('created') ? '✓ ' : '✗ '}{error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm py-2.5 uppercase tracking-widest transition-colors font-mono mt-2"
              >
                {loading ? 'AUTHENTICATING...' : mode === 'login' ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-mono">
                {mode === 'login' ? 'NO ACCOUNT?' : 'HAVE ACCESS?'}
              </span>
              <button
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                className="text-xs font-mono text-amber-500 hover:text-amber-400 uppercase tracking-wider transition-colors"
              >
                {mode === 'login' ? 'REGISTER →' : 'LOGIN →'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-1 mt-2">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs font-mono text-slate-700">SYS:READY</span>
        </div>
      </div>
    </div>
  )
}

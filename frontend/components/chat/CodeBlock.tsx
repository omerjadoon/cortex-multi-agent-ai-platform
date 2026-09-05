'use client'
import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Props {
  code: string
  language?: string
  label?: string
}

export function CodeBlock({ code, language = 'python', label = 'Generated Script' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'script.py'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-3 border border-slate-600 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-800 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-400" />
          <span className="text-xs font-mono font-medium text-slate-300 uppercase tracking-wider">{label}</span>
          <span className="text-xs font-mono text-slate-600 bg-slate-900 border border-slate-700 px-1.5 py-0.5">{language}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="text-xs font-mono text-slate-500 hover:text-amber-400 px-2 py-1 border border-transparent hover:border-amber-500/30 transition-colors"
          >
            {copied ? 'COPIED' : 'COPY'}
          </button>
          <button
            onClick={handleDownload}
            className="text-xs font-mono text-slate-500 hover:text-amber-400 px-2 py-1 border border-transparent hover:border-amber-500/30 transition-colors"
          >
            DOWNLOAD
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.75rem', maxHeight: '400px', background: '#0f172a' }}
        showLineNumbers
        lineNumberStyle={{ color: '#334155', fontSize: '0.7rem' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

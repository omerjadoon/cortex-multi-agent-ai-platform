import type { Role } from '@/types'

const roleStyles: Record<Role, string> = {
  admin: 'bg-amber-900/30 text-amber-400 border-amber-600/50',
  developer: 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50',
  viewer: 'bg-slate-800 text-slate-400 border-slate-600',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`text-xs font-mono font-medium px-2 py-0.5 border tracking-wider uppercase ${roleStyles[role]}`}>
      {role}
    </span>
  )
}

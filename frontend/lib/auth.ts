import type { User } from '@/types'

const TOKEN_KEY = 'cortex_token'
const USER_KEY = 'cortex_user'

export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token)
  // Also set cookie so Next.js middleware can read it server-side
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24}`
}

export const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

export const setUser = (user: User) =>
  localStorage.setItem(USER_KEY, JSON.stringify(user))

export const getUser = (): User | null => {
  if (typeof window === 'undefined') return null
  const s = localStorage.getItem(USER_KEY)
  return s ? JSON.parse(s) : null
}

export const clear = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  document.cookie = 'token=; path=/; max-age=0'
}

export const isAuthenticated = (): boolean =>
  typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY)

export const auth = {
  setToken,
  getToken,
  setUser,
  getUser,
  clear,
  isAuthenticated,
}

export default auth

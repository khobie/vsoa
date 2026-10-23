import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '@/lib/mock-data'

export interface SessionUser extends User {
  roles: Role[]
}

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  signIn: (institutionalId: string, password: string) => Promise<SessionUser>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Unable to complete the request')
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/me', { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 401) return null
        const data = await parseResponse(response)
        return data.user as SessionUser
      })
      .then((sessionUser) => setUser(sessionUser))
      .catch((error) => {
        if (error.name !== 'AbortError') setUser(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const signIn = useCallback(async (institutionalId: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ institutionalId, password }),
    })
    const data = await parseResponse(response)
    setUser(data.user)
    return data.user as SessionUser
  }, [])

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

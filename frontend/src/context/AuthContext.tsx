import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
  id: string
  username: string
  name: string
  email: string
  company_name: string
  phone: string
  address: string
  city: string
  state: string
  country: string
  profile_completed: boolean
}

interface SignupData {
  username: string
  email: string
  password: string
  name?: string
}

export interface ProfileUpdatePayload {
  name?: string
  company_name?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => void
  updateProfile: (payload: ProfileUpdatePayload) => Promise<User>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const STORAGE_KEY = 'reptruly_user'

// Older cached User objects didn't have the new profile fields. Fill in safe defaults
// so the React tree doesn't crash on first load after the upgrade.
function hydrate(raw: any): User {
  return {
    id: raw.id ?? '',
    username: raw.username ?? '',
    name: raw.name ?? '',
    email: raw.email ?? '',
    company_name: raw.company_name ?? '',
    phone: raw.phone ?? '',
    address: raw.address ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    country: raw.country ?? '',
    profile_completed: !!raw.profile_completed,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setUser(hydrate(JSON.parse(stored)))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setIsLoading(false)

    // Refresh from server in the background so any profile edits made elsewhere appear.
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) {
          const u = hydrate(data)
          setUser(u)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
        }
      })
      .catch(() => {})
  }, [])

  function persist(u: User) {
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }

  async function login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Invalid credentials')
    }
    persist(hydrate(await res.json()))
  }

  async function signup(data: SignupData) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Could not create account')
    }
    persist(hydrate(await res.json()))
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  async function updateProfile(payload: ProfileUpdatePayload): Promise<User> {
    const body: Record<string, string> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined) body[k] = v
    }
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Could not save profile')
    }
    const u = hydrate(await res.json())
    persist(u)
    return u
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './AuthContext'

/** Error that keeps the HTTP status so callers can react to 402 (upgrade required). */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface Property {
  id: string
  property_id: string
  property_name: string
  location: string
  ota: string
  booking_hotel_id: string
  expedia_property_id: string
  google_place_id: string
  last_synced_at: string | null
  sync_warnings?: string[]
}

export interface PropertyCreatePayload {
  property_name?: string
  booking_hotel_id?: string
  expedia_property_id?: string
  google_place_id?: string
}

// For PATCH: send '' to remove an OTA, omit a field to leave unchanged.
export interface PropertyUpdatePayload {
  property_name?: string
  booking_hotel_id?: string
  expedia_property_id?: string
  google_place_id?: string
}

interface PropertyContextType {
  properties: Property[]
  propertiesLoaded: boolean
  selectedProperty: Property | null
  setSelectedProperty: (p: Property | null) => void
  refresh: () => Promise<void>
  addProperty: (payload: PropertyCreatePayload) => Promise<Property>
  updateProperty: (id: string, payload: PropertyUpdatePayload) => Promise<Property>
  removeProperty: (id: string) => Promise<void>
}

const PropertyContext = createContext<PropertyContextType | null>(null)

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { user, sessionChecked } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesLoaded, setPropertiesLoaded] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setProperties([])
      setPropertiesLoaded(false)
      return
    }
    // Wait for the server to confirm the session; a stale cached user would 401 here.
    if (!sessionChecked) return
    try {
      const res = await fetch('/api/properties', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Property[] = await res.json()
      setProperties(data)
    } catch {
      setProperties([])
    } finally {
      setPropertiesLoaded(true)
    }
  }, [user, sessionChecked])

  useEffect(() => { refresh() }, [refresh])

  async function addProperty(payload: PropertyCreatePayload): Promise<Property> {
    const body: Record<string, string> = {}
    if (payload.property_name) body.property_name = payload.property_name
    if (payload.booking_hotel_id) body.booking_hotel_id = payload.booking_hotel_id
    if (payload.expedia_property_id) body.expedia_property_id = payload.expedia_property_id
    if (payload.google_place_id) body.google_place_id = payload.google_place_id
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(res.status, err.detail || err.message || 'Could not add property')
    }
    const created: Property = await res.json()
    setProperties(prev => [...prev, created])
    return created
  }

  async function updateProperty(id: string, payload: PropertyUpdatePayload): Promise<Property> {
    // Pass '' explicitly to remove an OTA — only omit when caller didn't include the key.
    const body: Record<string, string> = {}
    if (payload.property_name !== undefined) body.property_name = payload.property_name
    if (payload.booking_hotel_id !== undefined) body.booking_hotel_id = payload.booking_hotel_id
    if (payload.expedia_property_id !== undefined) body.expedia_property_id = payload.expedia_property_id
    if (payload.google_place_id !== undefined) body.google_place_id = payload.google_place_id
    const res = await fetch(`/api/properties/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(res.status, err.detail || err.message || 'Could not update property')
    }
    const updated: Property = await res.json()
    setProperties(prev => prev.map(p => (p.id === id ? updated : p)))
    setSelectedProperty(prev => (prev?.id === id ? updated : prev))
    return updated
  }

  async function removeProperty(id: string) {
    const res = await fetch(`/api/properties/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || err.message || 'Could not remove property')
    }
    setProperties(prev => prev.filter(p => p.id !== id))
    setSelectedProperty(prev => (prev?.id === id ? null : prev))
  }

  return (
    <PropertyContext.Provider
      value={{ properties, propertiesLoaded, selectedProperty, setSelectedProperty, refresh, addProperty, updateProperty, removeProperty }}
    >
      {children}
    </PropertyContext.Provider>
  )
}

export function useProperty() {
  const ctx = useContext(PropertyContext)
  if (!ctx) throw new Error('useProperty must be used within PropertyProvider')
  return ctx
}

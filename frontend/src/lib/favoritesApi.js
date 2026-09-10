import { API_BASE_URL } from './api'
import { supabase } from './supabaseClient'

export async function fetchFavoritedIds() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return new Set()

  const res = await fetch(`${API_BASE_URL}/api/favorites`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) return new Set()

  const data = await res.json()
  return new Set(data.items.map((item) => item.id))
}

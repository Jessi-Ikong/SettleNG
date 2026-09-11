import { API_BASE_URL } from './api'
import { supabase } from './supabaseClient'

export async function fetchTotalUnreadCount() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return 0

  const res = await fetch(`${API_BASE_URL}/api/conversations`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) return 0

  const data = await res.json()
  return data.items.reduce((sum, c) => sum + (c.unread_count || 0), 0)
}

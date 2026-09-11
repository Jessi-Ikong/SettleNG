import { API_BASE_URL } from './api'
import { supabase } from './supabaseClient'

export const EDIT_WINDOW_MS = 60 * 60 * 1000

export function canEditOrDelete(message, userId) {
  if (message.sender_id !== userId || message.is_deleted) return false
  return Date.now() - new Date(message.created_at).getTime() <= EDIT_WINDOW_MS
}

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function editMessage(id, body) {
  const res = await fetch(`${API_BASE_URL}/api/messages/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to edit message')
  return data
}

export async function deleteMessage(id) {
  const res = await fetch(`${API_BASE_URL}/api/messages/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to delete message')
  return data
}

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

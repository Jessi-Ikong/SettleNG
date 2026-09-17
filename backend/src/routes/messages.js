import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'
import { EDIT_WINDOW_MS, attachReplyPreviews } from '../lib/messageShape.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, body, reply_to_id, created_at, read_at, edited_at, original_body, deleted_at'

const EDIT_WINDOW_ERROR = 'Messages can only be edited within 1 hour of sending'
const DELETE_WINDOW_ERROR = 'Messages can only be deleted within 1 hour of sending'

router.use(requireAuth)
router.use(generalApiLimiter)

async function loadOwnedMessage(id, userId) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) return { error: 'lookup_failed' }
  if (!data) return { error: 'not_found' }
  if (data.sender_id !== userId) return { error: 'forbidden' }
  return { message: data }
}

function withinEditWindow(message) {
  return Date.now() - new Date(message.created_at).getTime() <= EDIT_WINDOW_MS
}

router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const { body } = req.body || {}

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Message ${id} not found` })
  }
  if (!body || !String(body).trim()) {
    return res.status(400).json({ error: 'A message body is required' })
  }

  const lookup = await loadOwnedMessage(id, req.profile.id)
  if (lookup.error === 'not_found') {
    return res.status(404).json({ error: `Message ${id} not found` })
  }
  if (lookup.error === 'forbidden') {
    return res.status(403).json({ error: 'You can only edit your own messages' })
  }
  if (lookup.error) {
    return res.status(500).json({ error: 'Failed to look up message' })
  }

  const { message } = lookup

  if (message.deleted_at) {
    return res.status(400).json({ error: 'This message has been deleted' })
  }
  if (!withinEditWindow(message)) {
    return res.status(400).json({ error: EDIT_WINDOW_ERROR })
  }

  const update = {
    body: String(body).trim(),
    edited_at: new Date().toISOString(),
  }
  if (!message.edited_at) {
    update.original_body = message.body
  }

  const { data, error } = await supabase
    .from('messages')
    .update(update)
    .eq('id', id)
    .select(
      'id, conversation_id, sender_id, body, reply_to_id, created_at, read_at, edited_at, deleted_at',
    )
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const [item] = await attachReplyPreviews(supabase, [data])

  res.json(item)
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Message ${id} not found` })
  }

  const lookup = await loadOwnedMessage(id, req.profile.id)
  if (lookup.error === 'not_found') {
    return res.status(404).json({ error: `Message ${id} not found` })
  }
  if (lookup.error === 'forbidden') {
    return res.status(403).json({ error: 'You can only delete your own messages' })
  }
  if (lookup.error) {
    return res.status(500).json({ error: 'Failed to look up message' })
  }

  const { message } = lookup

  if (message.deleted_at) {
    return res.status(400).json({ error: 'This message has already been deleted' })
  }
  if (!withinEditWindow(message)) {
    return res.status(400).json({ error: DELETE_WINDOW_ERROR })
  }

  const { data, error } = await supabase
    .from('messages')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_body: message.body,
    })
    .eq('id', id)
    .select(
      'id, conversation_id, sender_id, body, reply_to_id, created_at, read_at, edited_at, deleted_at',
    )
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const [item] = await attachReplyPreviews(supabase, [data])

  res.json(item)
})

export default router

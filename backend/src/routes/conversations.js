import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'
import { attachReplyPreviews, toMessageCard } from '../lib/messageShape.js'

const MESSAGE_COLUMNS =
  'id, conversation_id, sender_id, body, reply_to_id, created_at, read_at, edited_at, deleted_at'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CONVERSATION_JOIN = `
  id, property_id, tenant_id, owner_id, created_at,
  property:property_id(title, property_images(url, sort_order)),
  tenant:tenant_id(full_name),
  owner:owner_id(full_name)
`

function firstImage(property) {
  const images = [...(property?.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  return images[0]?.url ?? null
}

router.use(requireAuth)
router.use(generalApiLimiter)

async function getMembership(conversationId, userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, tenant_id, owner_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (error) return { error: 'lookup_failed' }
  if (!data) return { error: 'not_found' }
  if (data.tenant_id !== userId && data.owner_id !== userId) {
    return { error: 'forbidden' }
  }
  return { conversation: data }
}

router.post('/', async (req, res) => {
  const { property_id, body } = req.body || {}

  if (!property_id || !UUID_RE.test(property_id)) {
    return res.status(400).json({ error: 'A valid property_id is required' })
  }
  if (!body || !String(body).trim()) {
    return res.status(400).json({ error: 'A message body is required' })
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', property_id)
    .maybeSingle()

  if (propertyError) {
    return res.status(500).json({ error: 'Failed to look up property' })
  }
  if (!property) {
    return res.status(400).json({ error: `Property ${property_id} not found` })
  }
  if (property.owner_id === req.profile.id) {
    return res
      .status(400)
      .json({ error: "You can't message yourself about your own listing" })
  }

  let { data: conversation, error: findError } = await supabase
    .from('conversations')
    .select(CONVERSATION_JOIN)
    .eq('property_id', property_id)
    .eq('tenant_id', req.profile.id)
    .maybeSingle()

  if (findError) {
    return res.status(500).json({ error: 'Failed to look up conversation' })
  }

  if (!conversation) {
    const { data: created, error: createError } = await supabase
      .from('conversations')
      .insert({
        property_id,
        tenant_id: req.profile.id,
        owner_id: property.owner_id,
      })
      .select(CONVERSATION_JOIN)
      .single()

    if (createError) {
      return res.status(500).json({ error: createError.message })
    }
    conversation = created
  }

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: req.profile.id,
      body: String(body).trim(),
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (messageError) {
    return res.status(500).json({ error: messageError.message })
  }

  res.status(201).json({
    conversation: {
      id: conversation.id,
      property_id: conversation.property_id,
      property_title: conversation.property?.title ?? null,
      property_first_image: firstImage(conversation.property),
    },
    message: { ...toMessageCard(message), reply_preview: null },
  })
})

router.get('/', async (req, res) => {
  const userId = req.profile.id

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_JOIN)
    .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (conversations.length === 0) {
    return res.json({ items: [] })
  }

  const conversationIds = conversations.map((c) => c.id)

  const { data: rawMessages, error: messagesError } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })

  if (messagesError) {
    return res.status(500).json({ error: messagesError.message })
  }

  const messages = rawMessages.map(toMessageCard)

  const messagesByConversation = new Map()
  for (const message of messages) {
    const list = messagesByConversation.get(message.conversation_id) || []
    list.push(message)
    messagesByConversation.set(message.conversation_id, list)
  }

  const items = conversations.map((conversation) => {
    const isTenant = conversation.tenant_id === userId
    const convoMessages = messagesByConversation.get(conversation.id) || []
    const lastMessage = convoMessages[convoMessages.length - 1] || null
    const unreadCount = convoMessages.filter(
      (m) => m.sender_id !== userId && m.read_at === null,
    ).length

    return {
      id: conversation.id,
      property_id: conversation.property_id,
      property: {
        title: conversation.property?.title ?? null,
        first_image: firstImage(conversation.property),
      },
      other_party_name: isTenant
        ? conversation.owner?.full_name ?? null
        : conversation.tenant?.full_name ?? null,
      other_party_id: isTenant ? conversation.owner_id : conversation.tenant_id,
      last_message: lastMessage
        ? { body: lastMessage.body, created_at: lastMessage.created_at }
        : null,
      unread_count: unreadCount,
    }
  })

  items.sort((a, b) => {
    const aTime = a.last_message?.created_at || ''
    const bTime = b.last_message?.created_at || ''
    return bTime.localeCompare(aTime)
  })

  res.json({ items })
})

router.get('/:id/messages', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Conversation ${id} not found` })
  }

  const membership = await getMembership(id, req.profile.id)
  if (membership.error === 'not_found') {
    return res.status(404).json({ error: `Conversation ${id} not found` })
  }
  if (membership.error === 'forbidden') {
    return res
      .status(403)
      .json({ error: 'You are not part of this conversation' })
  }
  if (membership.error) {
    return res.status(500).json({ error: 'Failed to look up conversation' })
  }

  const pageSize = 50
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Fetch the requested "page" from the newest end (page 1 = most
  // recent 50), then reverse to oldest-first for display.
  const { data, error, count } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS, { count: 'exact' })
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = await attachReplyPreviews(supabase, [...data].reverse())

  res.json({
    items,
    page,
    pageSize,
    total: count,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
})

router.post('/:id/messages', async (req, res) => {
  const { id } = req.params
  const { body, reply_to_id: replyToId } = req.body || {}

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Conversation ${id} not found` })
  }
  if (!body || !String(body).trim()) {
    return res.status(400).json({ error: 'A message body is required' })
  }
  if (replyToId !== undefined && replyToId !== null && !UUID_RE.test(replyToId)) {
    return res.status(400).json({ error: 'Invalid reply_to_id' })
  }

  const membership = await getMembership(id, req.profile.id)
  if (membership.error === 'not_found') {
    return res.status(404).json({ error: `Conversation ${id} not found` })
  }
  if (membership.error === 'forbidden') {
    return res
      .status(403)
      .json({ error: 'You are not part of this conversation' })
  }
  if (membership.error) {
    return res.status(500).json({ error: 'Failed to look up conversation' })
  }

  if (replyToId) {
    const { data: replyTarget, error: replyError } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .eq('id', replyToId)
      .maybeSingle()

    if (replyError) {
      return res.status(500).json({ error: 'Failed to look up reply target' })
    }
    if (!replyTarget || replyTarget.conversation_id !== id) {
      return res
        .status(400)
        .json({ error: 'reply_to_id must reference a message in this conversation' })
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: req.profile.id,
      body: String(body).trim(),
      reply_to_id: replyToId || null,
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const [item] = await attachReplyPreviews(supabase, [data])

  res.status(201).json(item)
})

router.patch('/:id/read', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Conversation ${id} not found` })
  }

  const membership = await getMembership(id, req.profile.id)
  if (membership.error === 'not_found') {
    return res.status(404).json({ error: `Conversation ${id} not found` })
  }
  if (membership.error === 'forbidden') {
    return res
      .status(403)
      .json({ error: 'You are not part of this conversation' })
  }
  if (membership.error) {
    return res.status(500).json({ error: 'Failed to look up conversation' })
  }

  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .is('read_at', null)
    .neq('sender_id', req.profile.id)
    .select()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ marked_read: data.length })
})

export default router

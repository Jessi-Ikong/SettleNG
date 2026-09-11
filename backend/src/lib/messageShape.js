export const EDIT_WINDOW_MS = 60 * 60 * 1000

// Flattens a raw messages row into the shape exposed to clients.
// original_body/deleted_body are NEVER included here — they exist
// purely for potential future admin/dispute access, per README's
// accountability rules.
export function toMessageCard(message) {
  const isDeleted = Boolean(message.deleted_at)
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    body: isDeleted ? null : message.body,
    reply_to_id: message.reply_to_id ?? null,
    created_at: message.created_at,
    read_at: message.read_at,
    edited: Boolean(message.edited_at),
    is_deleted: isDeleted,
  }
}

// Attaches a reply_preview to each message that has a reply_to_id,
// batching the lookup of referenced messages into a single query
// rather than one query per reply.
export async function attachReplyPreviews(supabase, rawMessages) {
  const replyIds = [
    ...new Set(rawMessages.filter((m) => m.reply_to_id).map((m) => m.reply_to_id)),
  ]

  let replyMap = new Map()

  if (replyIds.length > 0) {
    const { data: replies } = await supabase
      .from('messages')
      .select('id, sender_id, body, deleted_at, sender:sender_id(full_name)')
      .in('id', replyIds)

    replyMap = new Map((replies || []).map((r) => [r.id, r]))
  }

  return rawMessages.map((m) => {
    const card = toMessageCard(m)

    if (!m.reply_to_id) {
      return { ...card, reply_preview: null }
    }

    const target = replyMap.get(m.reply_to_id)

    if (!target || target.deleted_at) {
      return { ...card, reply_preview: { deleted: true } }
    }

    return {
      ...card,
      reply_preview: {
        sender_name: target.sender?.full_name ?? null,
        snippet: target.body ? target.body.slice(0, 80) : '',
      },
    }
  })
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { canEditOrDelete, editMessage, deleteMessage } from '../lib/messagesApi'
import ReportButton from '../components/ReportButton'

function formatMessageTime(dateString) {
  return new Date(dateString).toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Mirrors the backend's toMessageCard shaping so a raw Realtime payload
// (which includes every column, deleted_body/original_body included)
// never lets those two fields reach component state or the DOM.
function shapeRealtimeMessage(raw) {
  const isDeleted = Boolean(raw.deleted_at)
  return {
    id: raw.id,
    conversation_id: raw.conversation_id,
    sender_id: raw.sender_id,
    body: isDeleted ? null : raw.body,
    reply_to_id: raw.reply_to_id ?? null,
    created_at: raw.created_at,
    read_at: raw.read_at,
    edited: Boolean(raw.edited_at),
    is_deleted: isDeleted,
  }
}

function resolveReplyPreview(replyToId, messagesList, otherPartyName, profile) {
  const target = messagesList.find((m) => m.id === replyToId)
  if (!target) return undefined
  if (target.is_deleted) return { deleted: true }
  const senderName =
    target.sender_id === profile?.id ? profile?.full_name : otherPartyName
  return {
    sender_name: senderName ?? null,
    snippet: target.body ? target.body.slice(0, 80) : '',
  }
}

export default function Messages() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTarget, setReplyTarget] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [, setTick] = useState(0)
  const bottomRef = useRef(null)

  const activeConversation = conversations.find((c) => c.id === conversationId)

  // Edit/Delete eligibility is time-based (1-hour window), so re-render
  // periodically even without user interaction — otherwise a tab left
  // open would keep showing the actions after the window has closed.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const loadConversations = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setConversations([])
      setLoadingList(false)
      return
    }

    const res = await fetch(`${API_BASE_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (!res.ok) {
      setConversations([])
      setLoadingList(false)
      return
    }

    const data = await res.json()
    setConversations(data.items)
    setLoadingList(false)
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Auto-select the first conversation only on a true cold landing on
  // the bare /messages route — never again afterward, even once
  // conversationId clears again. Without that guard this would
  // immediately re-redirect away every time the mobile "back to list"
  // link (or any other route to /messages) clears conversationId,
  // defeating the whole point of a way back to the list.
  const hasEverSelectedRef = useRef(Boolean(conversationId))
  useEffect(() => {
    if (conversationId) {
      hasEverSelectedRef.current = true
      return
    }
    if (conversations.length > 0 && !hasEverSelectedRef.current) {
      hasEverSelectedRef.current = true
      navigate(`/messages/${conversations[0].id}`, { replace: true })
    }
  }, [conversationId, conversations, navigate])

  const loadMessages = useCallback(async () => {
    if (!conversationId) return
    setLoadingMessages(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(
      `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
      { headers: { Authorization: `Bearer ${session.access_token}` } },
    )

    if (!res.ok) {
      setMessages([])
      setLoadingMessages(false)
      return
    }

    const data = await res.json()
    setMessages(data.items)
    setLoadingMessages(false)

    await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c,
      ),
    )
    window.dispatchEvent(new Event('unread-count-changed'))
  }, [conversationId])

  useEffect(() => {
    loadMessages()
    setReplyTarget(null)
    setEditingId(null)
    setConfirmDeleteId(null)
  }, [loadMessages])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const shaped = shapeRealtimeMessage(payload.new)

            setMessages((prev) => {
              if (prev.some((m) => m.id === shaped.id)) return prev
              const otherPartyName = conversations.find(
                (c) => c.id === conversationId,
              )?.other_party_name
              const reply_preview = shaped.reply_to_id
                ? resolveReplyPreview(
                    shaped.reply_to_id,
                    prev,
                    otherPartyName,
                    profile,
                  ) ?? { deleted: false }
                : null
              return [...prev, { ...shaped, reply_preview }]
            })

            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId
                  ? {
                      ...c,
                      last_message: {
                        body: shaped.body,
                        created_at: shaped.created_at,
                      },
                    }
                  : c,
              ),
            )

            if (payload.new.sender_id !== profile?.id) {
              supabase.auth.getSession().then(({ data: { session } }) => {
                fetch(
                  `${API_BASE_URL}/api/conversations/${conversationId}/read`,
                  {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  },
                ).then(() => {
                  window.dispatchEvent(new Event('unread-count-changed'))
                })
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const shaped = shapeRealtimeMessage(payload.new)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === shaped.id
                  ? { ...m, ...shaped, reply_preview: m.reply_preview }
                  : m,
              ),
            )
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== conversationId) return c
                if (c.last_message?.created_at !== shaped.created_at) return c
                return {
                  ...c,
                  last_message: { body: shaped.body, created_at: shaped.created_at },
                }
              }),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, profile?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (event) => {
    event.preventDefault()
    if (!draft.trim()) return
    setSending(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(
      `${API_BASE_URL}/api/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          body: draft.trim(),
          reply_to_id: replyTarget?.id,
        }),
      },
    )

    setSending(false)

    if (res.ok) {
      const message = await res.json()
      setDraft('')
      setReplyTarget(null)
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      )
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message: {
                  body: message.body,
                  created_at: message.created_at,
                },
              }
            : c,
        ),
      )
    }
  }

  const startEdit = (m) => {
    setConfirmDeleteId(null)
    setEditingId(m.id)
    setEditDraft(m.body)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const saveEdit = async (m) => {
    if (!editDraft.trim()) return
    try {
      const updated = await editMessage(m.id, editDraft.trim())
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === m.id ? { ...msg, ...updated, reply_preview: msg.reply_preview } : msg,
        ),
      )
      setEditingId(null)
      setEditDraft('')
    } catch (err) {
      window.alert(err.message)
    }
  }

  const confirmDelete = async (m) => {
    try {
      const updated = await deleteMessage(m.id)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === m.id ? { ...msg, ...updated, reply_preview: msg.reply_preview } : msg,
        ),
      )
      setConfirmDeleteId(null)
    } catch (err) {
      window.alert(err.message)
    }
  }

  const scrollToMessage = (id) => {
    const el = document.getElementById(`message-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('message-bubble-highlight')
    setTimeout(() => el.classList.remove('message-bubble-highlight'), 1200)
  }

  if (loadingList) {
    return <div className="page-loading">Loading...</div>
  }

  return (
    <div
      className={
        'messages-page' + (conversationId ? ' messages-page-thread-active' : '')
      }
    >
      <aside className="messages-list">
        {conversations.length === 0 ? (
          <p className="inspection-empty">No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              to={`/messages/${c.id}`}
              className={
                'messages-list-item' +
                (c.id === conversationId ? ' messages-list-item-active' : '')
              }
            >
              {c.property.first_image ? (
                <img
                  src={c.property.first_image}
                  alt=""
                  className="messages-list-thumb"
                />
              ) : (
                <div className="messages-list-thumb messages-list-thumb-empty" />
              )}
              <div className="messages-list-info">
                <span className="messages-list-name">
                  {c.other_party_name}
                </span>
                <span className="messages-list-property">
                  {c.property.title}
                </span>
                <span className="messages-list-preview">
                  {c.last_message?.body}
                </span>
              </div>
              {c.unread_count > 0 && (
                <span className="messages-unread-badge">
                  {c.unread_count}
                </span>
              )}
            </Link>
          ))
        )}
      </aside>

      <div className="messages-thread">
        {!activeConversation ? (
          <div className="messages-empty-state">
            {conversations.length === 0
              ? "You don't have any messages yet."
              : 'Select a conversation.'}
          </div>
        ) : (
          <>
            <div className="messages-thread-header">
              <Link
                to="/messages"
                className="messages-back-link"
                aria-label="Back to messages"
              >
                ← Messages
              </Link>
              {activeConversation.property.first_image && (
                <img
                  src={activeConversation.property.first_image}
                  alt=""
                  className="messages-thread-thumb"
                />
              )}
              <div className="messages-thread-info">
                <Link
                  to={`/properties/${activeConversation.property_id}`}
                  className="messages-thread-property"
                >
                  {activeConversation.property.title}
                </Link>
                <div className="messages-thread-other-row">
                  <p className="messages-thread-other">
                    {activeConversation.other_party_name}
                  </p>
                  {activeConversation.other_party_id && (
                    <ReportButton
                      targetType="user"
                      targetId={activeConversation.other_party_id}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="messages-thread-body">
              {loadingMessages ? (
                <div className="page-loading">Loading...</div>
              ) : (
                messages.map((m) => {
                  const isOwn = m.sender_id === profile?.id
                  const editable = canEditOrDelete(m, profile?.id)
                  const isEditing = editingId === m.id
                  const isConfirmingDelete = confirmDeleteId === m.id

                  return (
                    <div
                      key={m.id}
                      id={`message-${m.id}`}
                      className={
                        'message-bubble' +
                        (isOwn ? ' message-bubble-own' : ' message-bubble-other')
                      }
                    >
                      {m.reply_preview && (
                        <button
                          type="button"
                          className="message-reply-quote"
                          onClick={() =>
                            !m.reply_preview.deleted && scrollToMessage(m.reply_to_id)
                          }
                        >
                          {m.reply_preview.deleted ? (
                            <em>Original message deleted</em>
                          ) : (
                            <>
                              <span className="message-reply-quote-sender">
                                {m.reply_preview.sender_name}
                              </span>
                              <span className="message-reply-quote-snippet">
                                {m.reply_preview.snippet}
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      {m.is_deleted ? (
                        <p className="message-deleted">This message was deleted</p>
                      ) : isEditing ? (
                        <div className="message-edit-row">
                          <input
                            type="text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            autoFocus
                          />
                          <div className="message-edit-actions">
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => saveEdit(m)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-link"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p>
                          {m.body}
                          {m.edited && <span className="message-edited-tag"> (edited)</span>}
                        </p>
                      )}

                      <span className="message-bubble-time">
                        {formatMessageTime(m.created_at)}
                      </span>

                      {!m.is_deleted && !isEditing && (
                        <div
                          className={
                            'message-actions' +
                            (isConfirmingDelete ? ' message-actions-pinned' : '')
                          }
                        >
                          <button
                            type="button"
                            className="message-action-btn"
                            onClick={() => {
                              setEditingId(null)
                              setConfirmDeleteId(null)
                              setReplyTarget(m)
                            }}
                          >
                            Reply
                          </button>
                          {editable && (
                            <>
                              <button
                                type="button"
                                className="message-action-btn"
                                onClick={() => startEdit(m)}
                              >
                                Edit
                              </button>
                              {isConfirmingDelete ? (
                                <span className="message-delete-confirm">
                                  Delete?
                                  <button
                                    type="button"
                                    className="message-action-btn"
                                    onClick={() => confirmDelete(m)}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    className="message-action-btn"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="message-action-btn"
                                  onClick={() => setConfirmDeleteId(m.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {replyTarget && (
              <div className="messages-reply-preview">
                <div>
                  <span className="messages-reply-preview-label">
                    Replying to {replyTarget.sender_id === profile?.id
                      ? 'yourself'
                      : activeConversation.other_party_name}
                  </span>
                  <p className="messages-reply-preview-snippet">
                    {replyTarget.is_deleted
                      ? 'Original message deleted'
                      : (replyTarget.body || '').slice(0, 80)}
                  </p>
                </div>
                <button
                  type="button"
                  className="messages-reply-preview-cancel"
                  onClick={() => setReplyTarget(null)}
                  aria-label="Cancel reply"
                >
                  ×
                </button>
              </div>
            )}

            <form className="messages-input-row" onSubmit={handleSend}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit" className="btn-primary" disabled={sending}>
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

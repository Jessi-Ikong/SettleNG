import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatMessageTime(dateString) {
  return new Date(dateString).toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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
  const bottomRef = useRef(null)

  const activeConversation = conversations.find((c) => c.id === conversationId)

  const loadConversations = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const res = await fetch(`${API_BASE_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    setConversations(data.items)
    setLoadingList(false)
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!conversationId && conversations.length > 0) {
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
  }, [loadMessages])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id)
              ? prev
              : [...prev, payload.new],
          )
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    last_message: {
                      body: payload.new.body,
                      created_at: payload.new.created_at,
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
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, profile?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        body: JSON.stringify({ body: draft.trim() }),
      },
    )

    setSending(false)

    if (res.ok) {
      const message = await res.json()
      setDraft('')
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

  if (loadingList) {
    return <div className="page-loading">Loading...</div>
  }

  return (
    <div className="messages-page">
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
              {activeConversation.property.first_image && (
                <img
                  src={activeConversation.property.first_image}
                  alt=""
                  className="messages-thread-thumb"
                />
              )}
              <div>
                <Link
                  to={`/properties/${activeConversation.property_id}`}
                  className="messages-thread-property"
                >
                  {activeConversation.property.title}
                </Link>
                <p className="messages-thread-other">
                  {activeConversation.other_party_name}
                </p>
              </div>
            </div>

            <div className="messages-thread-body">
              {loadingMessages ? (
                <div className="page-loading">Loading...</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      'message-bubble' +
                      (m.sender_id === profile?.id
                        ? ' message-bubble-own'
                        : ' message-bubble-other')
                    }
                  >
                    <p>{m.body}</p>
                    <span className="message-bubble-time">
                      {formatMessageTime(m.created_at)}
                    </span>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

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

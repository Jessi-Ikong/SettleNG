import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

export default function MessageButton({ property, label = 'Message owner' }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user || profile?.id === property.owner_id) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!body.trim()) {
      setError('Please enter a message.')
      return
    }

    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ property_id: property.id, body: body.trim() }),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error || 'Failed to send message')
      return
    }

    navigate(`/messages/${result.conversation.id}`)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    )
  }

  return (
    <form className="inspection-request-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <div className="form-field">
        <label htmlFor="message-body">Message</label>
        <textarea
          id="message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Ask a question about this listing..."
        />
      </div>

      <div className="inspection-request-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send message'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

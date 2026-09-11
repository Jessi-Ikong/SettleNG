import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

export default function RequestInspectionButton({ property }) {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requested, setRequested] = useState(false)

  if (
    !user ||
    profile?.role !== 'tenant' ||
    profile.id === property.owner_id ||
    property.status !== 'available'
  ) {
    return null
  }

  if (requested) {
    return (
      <div className="inspection-confirmation">
        Inspection requested — track it on your dashboard.
      </div>
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!date || !time) {
      setError('Please choose a date and time.')
      return
    }

    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/inspections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        property_id: property.id,
        requested_date: date,
        requested_time: time,
        note: note || null,
      }),
    })

    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(body.error || 'Failed to request inspection')
      return
    }

    setRequested(true)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen(true)}
      >
        Request inspection
      </button>
    )
  }

  return (
    <form className="inspection-request-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="inspection-date">Date</label>
          <input
            id="inspection-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="inspection-time">Time</label>
          <input
            id="inspection-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="inspection-note">Note (optional)</label>
        <textarea
          id="inspection-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <div className="inspection-request-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Requesting...' : 'Send request'}
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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import { REPORT_REASONS } from '../lib/reports'

export default function ReportButton({ targetType, targetId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REPORT_REASONS[0].value)
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleOpen = () => {
    if (!user) {
      navigate('/login')
      return
    }
    setOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || null,
      }),
    })

    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(body.error || 'Failed to submit report')
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <span className="report-confirmation">
        Report submitted — thank you, our team will review it.
      </span>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        className="report-button"
        onClick={handleOpen}
        aria-label={`Report this ${targetType}`}
      >
        <svg viewBox="0 0 24 24" className="report-flag-icon" aria-hidden="true">
          <path d="M5 3v18M5 4h12l-2.5 4L17 12H5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        Report
      </button>
    )
  }

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      <div className="form-field">
        <label htmlFor="report-reason">Reason</label>
        <select
          id="report-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="report-details">Details (optional)</label>
        <textarea
          id="report-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={2}
        />
      </div>

      <div className="inspection-request-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit report'}
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

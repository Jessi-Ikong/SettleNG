import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatSubmittedDate(dateString) {
  return new Date(dateString).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AdminVerifications() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')

  const load = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/verification/identity/queue`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setItems(data.items || []))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    if (authLoading) return
    if (!profile || profile.role !== 'admin') {
      setLoading(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading])

  const submitDecision = async (id, status, adminNotes) => {
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    setBusyId(id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/verification/identity/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status, admin_notes: adminNotes || null }),
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({ ...prev, [id]: body.error || 'Failed to update' }))
      return
    }

    setItems((prev) => prev.filter((i) => i.id !== id))
    setRejectingId(null)
    setRejectNotes('')
  }

  const handleApprove = (id) => submitDecision(id, 'approved')

  const handleRejectConfirm = (id) => {
    if (!rejectNotes.trim()) {
      setRowErrors((prev) => ({ ...prev, [id]: 'A reason is required to reject' }))
      return
    }
    submitDecision(id, 'rejected', rejectNotes.trim())
  }

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only admins can view identity verifications.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Identity verifications</h1>

      {items.length === 0 ? (
        <p className="inspection-empty">No pending submissions.</p>
      ) : (
        <div className="admin-reports-list">
          {items.map((item) => (
            <div key={item.id} className="admin-report-row">
              <div className="admin-report-summary">
                <div className="admin-report-main">
                  <span className="admin-report-target">
                    {item.submitter_name || 'Unknown'}
                  </span>
                  <span className="admin-report-reason">
                    {item.submitter_email}
                  </span>
                  <span className="admin-report-date">
                    Submitted {formatSubmittedDate(item.created_at)}
                  </span>
                </div>
                {item.document_signed_url && (
                  <a
                    href={item.document_signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    View document
                  </a>
                )}
              </div>

              {rowErrors[item.id] && (
                <div className="form-error">{rowErrors[item.id]}</div>
              )}

              {rejectingId === item.id ? (
                <div className="inspection-action-form">
                  <textarea
                    placeholder="Reason for rejecting (required)"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    rows={2}
                  />
                  <div className="inspection-request-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyId === item.id}
                      onClick={() => handleRejectConfirm(item.id)}
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setRejectingId(null)
                        setRejectNotes('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inspection-request-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === item.id}
                    onClick={() => handleApprove(item.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === item.id}
                    onClick={() => {
                      setRejectingId(item.id)
                      setRejectNotes('')
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

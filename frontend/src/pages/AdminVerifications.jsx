import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

function useVerificationQueue(kind, active) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')

  const load = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/verification/${kind}/queue`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setItems(data.items || []))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    if (!active) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const submitDecision = async (id, status, adminNotes) => {
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    setBusyId(id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/verification/${kind}/${id}`, {
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

  return {
    items,
    loading,
    rowErrors,
    busyId,
    rejectingId,
    rejectNotes,
    setRejectNotes,
    handleApprove,
    startReject: (id) => {
      setRejectingId(id)
      setRejectNotes('')
    },
    cancelReject: () => {
      setRejectingId(null)
      setRejectNotes('')
    },
    handleRejectConfirm,
  }
}

function ReviewActions({ item, queue }) {
  return (
    <>
      {queue.rowErrors[item.id] && (
        <div className="form-error">{queue.rowErrors[item.id]}</div>
      )}

      {queue.rejectingId === item.id ? (
        <div className="inspection-action-form">
          <textarea
            placeholder="Reason for rejecting (required)"
            value={queue.rejectNotes}
            onChange={(e) => queue.setRejectNotes(e.target.value)}
            rows={2}
          />
          <div className="inspection-request-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={queue.busyId === item.id}
              onClick={() => queue.handleRejectConfirm(item.id)}
            >
              Confirm reject
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={queue.cancelReject}
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
            disabled={queue.busyId === item.id}
            onClick={() => queue.handleApprove(item.id)}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={queue.busyId === item.id}
            onClick={() => queue.startReject(item.id)}
          >
            Reject
          </button>
        </div>
      )}
    </>
  )
}

function IdentityQueue({ active }) {
  const queue = useVerificationQueue('identity', active)

  if (queue.loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (queue.items.length === 0) {
    return <p className="inspection-empty">No pending submissions.</p>
  }

  return (
    <div className="admin-reports-list">
      {queue.items.map((item) => (
        <div key={item.id} className="admin-report-row">
          <div className="admin-report-summary">
            <div className="admin-report-main">
              <span className="admin-report-target">
                {item.submitter_name || 'Unknown'}
              </span>
              <span className="admin-report-reason">{item.submitter_email}</span>
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

          <ReviewActions item={item} queue={queue} />
        </div>
      ))}
    </div>
  )
}

function PropertyQueue({ active }) {
  const queue = useVerificationQueue('property', active)

  if (queue.loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (queue.items.length === 0) {
    return <p className="inspection-empty">No pending submissions.</p>
  }

  return (
    <div className="admin-reports-list">
      {queue.items.map((item) => (
        <div key={item.id} className="admin-report-row">
          <div className="admin-report-summary">
            {item.property_first_image ? (
              <img
                src={item.property_first_image}
                alt={item.property_title}
                className="my-property-thumb"
              />
            ) : (
              <div className="my-property-thumb my-property-thumb-empty">
                No photo
              </div>
            )}
            <div className="admin-report-main">
              <span className="admin-report-target">
                <Link to={`/properties/${item.property_id}`}>
                  {item.property_title}
                </Link>
              </span>
              <span className="admin-report-reason">
                Owner: {item.owner_name}
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

          <ReviewActions item={item} queue={queue} />
        </div>
      ))}
    </div>
  )
}

export default function AdminVerifications() {
  const { profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState('identity')

  if (authLoading) {
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
      <h1>Verifications</h1>

      <div className="admin-reports-filters">
        <button
          type="button"
          className={
            'btn-secondary' + (tab === 'identity' ? ' btn-secondary-active' : '')
          }
          onClick={() => setTab('identity')}
        >
          Identity
        </button>
        <button
          type="button"
          className={
            'btn-secondary' + (tab === 'property' ? ' btn-secondary-active' : '')
          }
          onClick={() => setTab('property')}
        >
          Property ownership
        </button>
      </div>

      {tab === 'identity' ? (
        <IdentityQueue active={tab === 'identity'} />
      ) : (
        <PropertyQueue active={tab === 'property'} />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatLogDate(dateString) {
  return new Date(dateString).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function describeEntry(entry) {
  const d = entry.details || {}

  switch (entry.action) {
    case 'user.suspend':
      return `Suspended user "${d.target_full_name || entry.target_id}": "${d.reason || ''}"`
    case 'user.unsuspend':
      return `Unsuspended user "${d.target_full_name || entry.target_id}"`
    case 'identity_verification.approve':
      return `Approved an identity verification submission`
    case 'identity_verification.reject':
      return `Rejected an identity verification submission${d.admin_notes ? `: "${d.admin_notes}"` : ''}`
    case 'property_verification.approve':
      return `Approved a property ownership verification submission`
    case 'property_verification.reject':
      return `Rejected a property ownership verification submission${d.admin_notes ? `: "${d.admin_notes}"` : ''}`
    case 'report.status_change':
      return `Changed a report's status from "${d.old_status}" to "${d.new_status}"`
    case 'state.activate':
      return `Activated the state "${d.state_name || entry.target_id}"`
    case 'state.deactivate':
      return `Deactivated the state "${d.state_name || entry.target_id}"`
    default:
      return entry.action
  }
}

export default function AdminAuditLog() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (authLoading) return
    if (!profile || profile.role !== 'admin') {
      setLoading(false)
      return
    }

    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/admin/audit-log?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setItems(data.items || [])
          setTotalPages(data.totalPages || 1)
        })
        .finally(() => setLoading(false))
    })
  }, [profile, authLoading, page])

  if (authLoading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only admins can view the audit log.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Audit log</h1>

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : items.length === 0 ? (
        <p className="inspection-empty">No admin actions logged yet.</p>
      ) : (
        <div className="admin-reports-list">
          {items.map((entry) => (
            <div key={entry.id} className="admin-report-row">
              <div className="admin-report-main">
                <span className="admin-report-target">
                  {entry.admin_name || 'Unknown admin'}
                </span>
                <span className="admin-report-reason">{describeEntry(entry)}</span>
                <span className="admin-report-date">
                  {formatLogDate(entry.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-users-pagination">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

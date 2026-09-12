import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const ROLE_FILTERS = ['all', 'tenant', 'landlord', 'agent', 'admin']

function formatUserDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function AdminUsers() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [suspendingId, setSuspendingId] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')

  const load = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (search.trim()) params.set('search', search.trim())

      fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setItems(data.items || [])
          setTotalPages(data.totalPages || 1)
        })
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
  }, [profile, authLoading, page, roleFilter])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    setPage(1)
    load()
  }

  const startSuspend = (id) => {
    setSuspendingId(id)
    setSuspendReason('')
  }

  const cancelSuspend = () => {
    setSuspendingId(null)
    setSuspendReason('')
  }

  const handleSuspendConfirm = async (id) => {
    if (!suspendReason.trim()) {
      setRowErrors((prev) => ({ ...prev, [id]: 'A reason is required to suspend' }))
      return
    }

    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    setBusyId(id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/suspend`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ reason: suspendReason.trim() }),
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({ ...prev, [id]: body.error || 'Failed to suspend' }))
      return
    }

    setItems((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, suspended: true, suspended_reason: body.suspended_reason }
          : u,
      ),
    )
    setSuspendingId(null)
    setSuspendReason('')
  }

  const handleUnsuspend = async (id) => {
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    setBusyId(id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/unsuspend`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({ ...prev, [id]: body.error || 'Failed to unsuspend' }))
      return
    }

    setItems((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, suspended: false, suspended_reason: null } : u,
      ),
    )
  }

  if (authLoading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only admins can view users.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Users</h1>

      <form className="admin-users-filters" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'All roles' : r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : items.length === 0 ? (
        <p className="inspection-empty">No users found.</p>
      ) : (
        <div className="admin-reports-list">
          {items.map((u) => (
            <div key={u.id} className="admin-report-row">
              <div className="admin-report-summary">
                <div className="admin-report-main">
                  <span className="admin-report-target">
                    {u.full_name || 'Unknown'}
                  </span>
                  <span className="admin-report-reason">{u.email}</span>
                  <span className="admin-user-badges">
                    <span className="status-badge status-rented">{u.role}</span>
                    {u.phone_verified && (
                      <span className="badge-verified">🟢 Phone</span>
                    )}
                    {u.identity_verified && (
                      <span className="badge-verified">🟢 Identity</span>
                    )}
                    {u.suspended && (
                      <span className="status-badge status-suspended">
                        Suspended
                      </span>
                    )}
                  </span>
                  {u.suspended && u.suspended_reason && (
                    <span className="admin-report-reason">
                      Reason: "{u.suspended_reason}"
                    </span>
                  )}
                  <span className="admin-report-date">
                    Joined {formatUserDate(u.created_at)}
                  </span>
                </div>
              </div>

              {rowErrors[u.id] && (
                <div className="form-error">{rowErrors[u.id]}</div>
              )}

              {u.id === profile.id ? null : suspendingId === u.id ? (
                <div className="inspection-action-form">
                  <textarea
                    placeholder="Reason for suspending (required)"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    rows={2}
                  />
                  <div className="inspection-request-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyId === u.id}
                      onClick={() => handleSuspendConfirm(u.id)}
                    >
                      Confirm suspend
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={cancelSuspend}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inspection-request-actions">
                  {u.suspended ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busyId === u.id}
                      onClick={() => handleUnsuspend(u.id)}
                    >
                      Unsuspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busyId === u.id}
                      onClick={() => startSuspend(u.id)}
                    >
                      Suspend
                    </button>
                  )}
                </div>
              )}
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

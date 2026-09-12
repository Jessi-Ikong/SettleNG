import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function AdminLocations() {
  const { profile, loading: authLoading } = useAuth()
  const [states, setStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [rowErrors, setRowErrors] = useState({})
  const [rowWarnings, setRowWarnings] = useState({})

  const load = () => {
    setLoading(true)
    fetch(`${API_BASE_URL}/api/locations/states`)
      .then((res) => res.json())
      .then((data) => setStates(data || []))
      .finally(() => setLoading(false))
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

  const handleToggle = async (state) => {
    const nextActive = !state.active
    setRowErrors((prev) => ({ ...prev, [state.id]: '' }))
    setRowWarnings((prev) => ({ ...prev, [state.id]: '' }))
    setBusyId(state.id)

    // Optimistic update — flip immediately, revert if the request fails.
    setStates((prev) =>
      prev.map((s) => (s.id === state.id ? { ...s, active: nextActive } : s)),
    )

    if (!nextActive) {
      fetch(`${API_BASE_URL}/api/properties?state_id=${state.id}&limit=1`)
        .then((res) => res.json())
        .then((data) => {
          if (data.total > 0) {
            setRowWarnings((prev) => ({
              ...prev,
              [state.id]: `This state has ${data.total} active listing(s) — they will no longer appear in search while deactivated.`,
            }))
          }
        })
        .catch(() => {})
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/admin/states/${state.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ active: nextActive }),
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      // Revert the optimistic flip.
      setStates((prev) =>
        prev.map((s) => (s.id === state.id ? { ...s, active: state.active } : s)),
      )
      setRowErrors((prev) => ({
        ...prev,
        [state.id]: body.error || 'Failed to update state',
      }))
    }
  }

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only admins can view locations.</p>
        </div>
      </div>
    )
  }

  const activeCount = states.filter((s) => s.active).length

  return (
    <div className="property-list-page">
      <h1>Locations</h1>
      <p className="admin-locations-count">
        {activeCount} of {states.length} states active
      </p>

      <div className="admin-reports-list">
        {states.map((state) => (
          <div key={state.id} className="admin-report-row">
            <div className="admin-report-summary">
              <div className="admin-report-main">
                <span className="admin-report-target">{state.name}</span>
                <span
                  className={
                    state.active ? 'verified-status' : 'not-verified-status'
                  }
                >
                  {state.active ? '🟢 Active' : 'Inactive'}
                </span>
              </div>

              <label className="admin-state-toggle">
                <input
                  type="checkbox"
                  checked={state.active}
                  disabled={busyId === state.id}
                  onChange={() => handleToggle(state)}
                />
                <span>{state.active ? 'Deactivate' : 'Activate'}</span>
              </label>
            </div>

            {rowErrors[state.id] && (
              <div className="form-error">{rowErrors[state.id]}</div>
            )}
            {rowWarnings[state.id] && (
              <p className="admin-state-warning">{rowWarnings[state.id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

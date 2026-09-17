import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function MyBuildings() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!profile || !['landlord', 'agent'].includes(profile.role)) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/buildings?mine=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          if (!res.ok) {
            setLoadError(true)
            return
          }
          const data = await res.json()
          setItems(data.items || [])
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false))
    })
  }, [authLoading, profile])

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || !['landlord', 'agent'].includes(profile.role)) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only landlords and agents have buildings to manage.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>My buildings</h1>

      {loadError ? (
        <div className="form-error">
          Something went wrong loading this page — try again.
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>You haven't added any buildings yet.</p>
          <Link to="/create-property" className="btn-secondary">
            List a property
          </Link>
        </div>
      ) : (
        <div className="my-properties-list">
          {items.map((building) => (
            <div key={building.id} className="my-property-row">
              <div className="my-property-info">
                <Link
                  to={`/buildings/${building.id}`}
                  className="my-property-title"
                >
                  {building.name}
                </Link>
                <p className="property-card-location">
                  {building.neighborhood.name}, {building.ward.lga.name},{' '}
                  {building.ward.lga.state.name}
                </p>
                <p className="tenancy-history-meta">
                  {building.available_units_count} of{' '}
                  {building.total_units_count} units available
                </p>
              </div>
              <div className="my-property-controls">
                <Link
                  to={`/create-property?building_id=${building.id}`}
                  className="btn-secondary"
                >
                  Add a unit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

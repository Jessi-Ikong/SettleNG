import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

function formatTenancyDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function TenancyHistory() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!profile || profile.role !== 'tenant') {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/tenancies/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setItems(data.items || []))
        .finally(() => setLoading(false))
    })
  }, [authLoading, profile])

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'tenant') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only tenants have rental history to view.</p>
        </div>
      </div>
    )
  }

  const history = items.filter((t) => t.ended_at)

  return (
    <div className="property-list-page">
      <h1>Rental history</h1>

      {history.length === 0 ? (
        <div className="empty-state">
          <p>You don't have any past tenancies yet.</p>
        </div>
      ) : (
        <div className="tenancy-history-list">
          {history.map((t) => (
            <Link
              key={t.id}
              to={t.property ? `/properties/${t.property.id}` : '#'}
              className="tenancy-history-item"
            >
              {t.property?.first_image ? (
                <img
                  src={t.property.first_image}
                  alt={t.property.title}
                  className="tenancy-history-thumb"
                />
              ) : (
                <div className="tenancy-history-thumb tenancy-history-thumb-empty">
                  No photo
                </div>
              )}
              <div className="tenancy-history-info">
                <span className="tenancy-history-title">
                  {t.property?.title || 'Property no longer available'}
                </span>
                <span className="tenancy-history-meta">
                  {formatTenancyDate(t.started_at)} –{' '}
                  {formatTenancyDate(t.ended_at)}
                </span>
                <span className="tenancy-history-meta">
                  Landlord: {t.landlord_name || 'Unknown'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

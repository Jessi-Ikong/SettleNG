import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const STAT_CARDS = [
  { key: 'total_users', label: 'Total users' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'landlords', label: 'Landlords' },
  { key: 'agents', label: 'Agents' },
  { key: 'total_properties', label: 'Total properties' },
  { key: 'active_listings', label: 'Active listings' },
  { key: 'rented_properties', label: 'Rented properties' },
  { key: 'phone_verified_users', label: 'Phone-verified users' },
  { key: 'identity_verified_users', label: 'Identity-verified users' },
  { key: 'ownership_verified_properties', label: 'Ownership-verified properties' },
  { key: 'completed_inspections', label: 'Completed inspections' },
]

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!profile || profile.role !== 'admin') {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error)
          } else {
            setStats(data)
          }
        })
        .finally(() => setLoading(false))
    })
  }, [profile, authLoading])

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only admins can view the dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Admin dashboard</h1>

      {error && <div className="form-error">{error}</div>}

      {stats && (
        <div className="admin-stats-grid">
          {STAT_CARDS.map((card) => (
            <div key={card.key} className="admin-stat-card">
              <span className="admin-stat-value">{stats[card.key]}</span>
              <span className="admin-stat-label">{card.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin-quicklinks-grid">
        <Link to="/admin/reports" className="admin-quicklink-card">
          <span className="admin-quicklink-title">Reports</span>
          {stats?.pending_reports > 0 && (
            <span className="admin-quicklink-badge">{stats.pending_reports}</span>
          )}
        </Link>
        <Link to="/admin/verifications" className="admin-quicklink-card">
          <span className="admin-quicklink-title">Identity verifications</span>
          {stats?.pending_identity_verifications > 0 && (
            <span className="admin-quicklink-badge">
              {stats.pending_identity_verifications}
            </span>
          )}
        </Link>
        <Link to="/admin/verifications" className="admin-quicklink-card">
          <span className="admin-quicklink-title">Property verifications</span>
          {stats?.pending_property_verifications > 0 && (
            <span className="admin-quicklink-badge">
              {stats.pending_property_verifications}
            </span>
          )}
        </Link>
        <Link to="/admin/users" className="admin-quicklink-card">
          <span className="admin-quicklink-title">Users</span>
        </Link>
      </div>
    </div>
  )
}

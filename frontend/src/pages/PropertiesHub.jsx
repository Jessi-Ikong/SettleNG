import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

const STATUS_ORDER = [
  'available',
  'draft',
  'pending',
  'rented',
  'unavailable',
  'suspended',
]

function summarizePropertyStatuses(items) {
  const counts = {}
  for (const item of items) {
    counts[item.status] = (counts[item.status] || 0) + 1
  }

  const parts = STATUS_ORDER.filter((status) => counts[status] > 0).map(
    (status) => `${counts[status]} ${status}`,
  )

  return parts.length > 0 ? parts.join(', ') : 'No properties yet'
}

export default function PropertiesHub() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [propertiesSummary, setPropertiesSummary] = useState('')
  const [buildingsCount, setBuildingsCount] = useState(0)

  useEffect(() => {
    if (authLoading) return

    if (!profile || !['landlord', 'agent'].includes(profile.role)) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      Promise.all([
        fetch(`${API_BASE_URL}/api/properties?mine=true`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((res) => res.json()),
        fetch(`${API_BASE_URL}/api/buildings?mine=true`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((res) => res.json()),
      ])
        .then(([propertiesData, buildingsData]) => {
          setPropertiesSummary(summarizePropertyStatuses(propertiesData.items || []))
          setBuildingsCount((buildingsData.items || []).length)
        })
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
          <p>Only landlords and agents can manage properties.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Properties</h1>

      <div className="hub-cards-grid">
        <Link to="/create-property" className="hub-card">
          <span className="hub-card-title">List a property</span>
        </Link>
        <Link to="/my-properties" className="hub-card">
          <span className="hub-card-title">My Properties</span>
          <span className="hub-card-context">{propertiesSummary}</span>
        </Link>
        <Link to="/my-buildings" className="hub-card">
          <span className="hub-card-title">My Buildings</span>
          <span className="hub-card-context">
            {buildingsCount} {buildingsCount === 1 ? 'building' : 'buildings'}
          </span>
        </Link>
      </div>
    </div>
  )
}

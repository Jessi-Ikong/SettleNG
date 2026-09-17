import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import PropertyCard from '../components/PropertyCard'

export default function SavedProperties() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/favorites`, {
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
  }, [])

  const handleUnfavorite = (propertyId) => {
    setItems((prev) => prev.filter((p) => p.id !== propertyId))
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  return (
    <div className="property-list-page">
      <h1>Saved properties</h1>

      {loadError ? (
        <div className="form-error">
          Something went wrong loading this page — try again.
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>You haven't saved any properties yet.</p>
          <Link to="/properties" className="btn-secondary">
            Browse properties
          </Link>
        </div>
      ) : (
        <div className="property-card-grid">
          {items.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              favorited={true}
              onToggleFavorite={(favorited) => {
                if (!favorited) handleUnfavorite(property.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import FavoriteButton from '../components/FavoriteButton'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export default function SavedProperties() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setItems(data.items))
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

      {items.length === 0 ? (
        <div className="empty-state">
          <p>You haven't saved any properties yet.</p>
          <Link to="/properties" className="btn-secondary">
            Browse properties
          </Link>
        </div>
      ) : (
        <div className="property-card-grid">
          {items.map((property) => {
            const unavailable = property.status !== 'available'
            return (
              <Link
                key={property.id}
                to={`/properties/${property.id}`}
                className={
                  'property-card' + (unavailable ? ' property-card-muted' : '')
                }
              >
                <div className="property-card-media">
                  {property.first_image ? (
                    <img
                      src={property.first_image}
                      alt={property.title}
                      className="property-card-image"
                    />
                  ) : (
                    <div className="property-card-image property-card-image-empty">
                      No photo
                    </div>
                  )}
                  <FavoriteButton
                    propertyId={property.id}
                    initialFavorited={true}
                    onToggle={(favorited) => {
                      if (!favorited) handleUnfavorite(property.id)
                    }}
                  />
                </div>
                <div className="property-card-body">
                  {unavailable ? (
                    <span className="badge-unavailable">
                      No longer available
                    </span>
                  ) : (
                    <span className="badge-available">{property.status}</span>
                  )}
                  <h3>{property.title}</h3>
                  <p className="property-card-location">
                    {property.neighborhood.name}, {property.ward.lga.name},{' '}
                    {property.ward.lga.state.name}
                  </p>
                  <p className="property-card-cost">
                    {property.move_in_cost.total != null
                      ? formatNaira(property.move_in_cost.total)
                      : 'Move-in cost not provided'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

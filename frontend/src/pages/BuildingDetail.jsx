import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchFavoritedIds } from '../lib/favoritesApi'
import PropertyCard from '../components/PropertyCard'

export default function BuildingDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [building, setBuilding] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [favoritedIds, setFavoritedIds] = useState(new Set())

  useEffect(() => {
    setLoading(true)
    setNotFound(false)

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/buildings/${id}`, {
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
        .then(async (res) => {
          if (!res.ok) {
            setNotFound(true)
            return
          }
          setBuilding(await res.json())
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false))
    })
  }, [id])

  useEffect(() => {
    if (!user) {
      setFavoritedIds(new Set())
      return
    }
    fetchFavoritedIds().then(setFavoritedIds)
  }, [user])

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (notFound || !building) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not found</h1>
          <p>This building isn't available.</p>
          <Link to="/properties">Back to listings</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>{building.name}</h1>

      <div className="signpost-trail">
        <span className="signpost-chip signpost-chip-static">
          {building.ward.lga.state.name}
        </span>
        <span className="signpost-chip signpost-chip-static">
          {building.ward.lga.name}
        </span>
        <span className="signpost-chip signpost-chip-static">
          {building.ward.name}
        </span>
        <span className="signpost-chip signpost-chip-static">
          {building.neighborhood.name}
        </span>
      </div>
      {building.street && <p className="property-street">{building.street}</p>}

      {building.description && (
        <p className="property-description">{building.description}</p>
      )}

      <p className="building-units-summary">
        {building.available_units_count} of {building.total_units_count} units
        available
      </p>

      {building.units.length === 0 ? (
        <div className="empty-state">
          <p>No units listed for this building yet.</p>
        </div>
      ) : (
        <div className="property-card-grid">
          {building.units.map((unit) => (
            <PropertyCard
              key={unit.id}
              property={unit}
              favorited={favoritedIds.has(unit.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

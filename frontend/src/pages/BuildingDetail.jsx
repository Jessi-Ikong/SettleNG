import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { STATUS_META, formatNaira } from '../lib/propertyStatus'
import PayButton from '../components/PayButton'

export default function BuildingDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [building, setBuilding] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

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
        <div className="unit-comparison-list">
          {building.units.map((unit) => {
            const meta = STATUS_META[unit.status] || {
              label: unit.status,
              className: '',
            }
            const facts = [
              unit.bedrooms != null ? `${unit.bedrooms} bed` : null,
              unit.bathrooms != null ? `${unit.bathrooms} bath` : null,
            ]
              .filter(Boolean)
              .join(' · ')

            const isProspectiveTenant =
              user &&
              profile?.role === 'tenant' &&
              profile.id !== unit.owner_id

            return (
              <div key={unit.id} className="unit-comparison-row">
                <Link
                  to={`/properties/${unit.id}`}
                  className="unit-comparison-info"
                >
                  <span className="unit-comparison-label">
                    {unit.unit_label || 'Unit'}
                  </span>
                  <span className="unit-comparison-facts">
                    {facts || 'Details not provided'}
                  </span>
                  <span className="unit-comparison-rent">
                    {unit.rent_amount != null
                      ? formatNaira(unit.rent_amount)
                      : 'Rent not provided'}
                  </span>
                  <span className={`status-badge ${meta.className}`}>
                    {meta.label}
                  </span>
                </Link>

                {unit.status === 'available' && isProspectiveTenant && (
                  unit.viewer_can_pay ? (
                    <PayButton property={unit} />
                  ) : (
                    <Link
                      to={`/properties/${unit.id}`}
                      className="btn-secondary unit-comparison-action"
                    >
                      Request inspection first
                    </Link>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { PRICING_FIELDS, PROPERTY_TYPES } from '../lib/amenities'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export default function PropertyDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [property, setProperty] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const loadProperty = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/properties/${id}`, {
      headers: session
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    })

    if (!res.ok) {
      setNotFound(true)
      return
    }

    setProperty(await res.json())
  }

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    loadProperty()
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const handlePublish = async () => {
    setPublishing(true)
    setPublishError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/properties/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status: 'available' }),
    })

    if (!res.ok) {
      const updated = await res.json()
      setPublishing(false)
      setPublishError(updated.error || 'Failed to publish')
      return
    }

    // The PATCH response doesn't carry the joined images/move_in_cost
    // shape the detail page needs — re-fetch the full detail instead
    // of rendering the raw PATCH response.
    await loadProperty()
    setPublishing(false)
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (notFound || !property) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not found</h1>
          <p>This property isn't available.</p>
          <Link to="/properties">Back to listings</Link>
        </div>
      </div>
    )
  }

  const typeLabel =
    PROPERTY_TYPES.find((t) => t.value === property.property_type)?.label ||
    property.property_type

  return (
    <div className="property-detail-page">
      <div className="property-detail-card">
        {property.images.length > 0 ? (
          <div className="property-gallery">
            {property.images.map((image) => (
              <img key={image.id} src={image.url} alt={property.title} />
            ))}
          </div>
        ) : (
          <div className="property-gallery-empty">No photos yet</div>
        )}

        <div className="property-detail-header">
          <h1>{property.title}</h1>
          <span className="badge-not-verified">Not yet verified</span>
          {property.status !== 'available' && (
            <span className="badge-draft">{property.status}</span>
          )}
        </div>

        <p className="property-type-label">{typeLabel}</p>

        {profile?.id === property.owner_id && property.status === 'draft' && (
          <div className="owner-actions">
            {publishError && <div className="form-error">{publishError}</div>}
            <button
              type="button"
              className="btn-primary"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? 'Publishing...' : 'Publish listing'}
            </button>
            <p className="owner-actions-hint">
              This listing is only visible to you until you publish it.
            </p>
          </div>
        )}

        <div className="signpost-trail">
          <span className="signpost-chip signpost-chip-static">
            {property.ward.lga.state.name}
          </span>
          <span className="signpost-chip signpost-chip-static">
            {property.ward.lga.name}
          </span>
          <span className="signpost-chip signpost-chip-static">
            {property.ward.name}
          </span>
          <span className="signpost-chip signpost-chip-static">
            {property.neighborhood.name}
          </span>
        </div>
        {property.street && (
          <p className="property-street">{property.street}</p>
        )}

        {property.description && (
          <p className="property-description">{property.description}</p>
        )}

        <div className="property-facts">
          {property.bedrooms != null && <span>{property.bedrooms} bed</span>}
          {property.bathrooms != null && (
            <span>{property.bathrooms} bath</span>
          )}
          {property.toilets != null && <span>{property.toilets} toilet</span>}
          {property.furnished && <span>{property.furnished}</span>}
        </div>

        {property.amenities?.length > 0 && (
          <div className="property-amenities">
            {property.amenities.map((amenity) => (
              <span key={amenity} className="amenity-tag">
                {amenity}
              </span>
            ))}
          </div>
        )}

        <h2>Move-in cost breakdown</h2>
        <table className="cost-breakdown-table">
          <tbody>
            {PRICING_FIELDS.map(({ key, label }) => (
              <tr key={key}>
                <td>{label}</td>
                <td className={property[key] == null ? 'not-provided' : ''}>
                  {property[key] != null
                    ? formatNaira(property[key])
                    : 'Not provided'}
                </td>
              </tr>
            ))}
            <tr className="cost-total-row">
              <td>Estimated Move-in Cost</td>
              <td>
                {property.move_in_cost.total != null
                  ? formatNaira(property.move_in_cost.total)
                  : 'Not provided'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

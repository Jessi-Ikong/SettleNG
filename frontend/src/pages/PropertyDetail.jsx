import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchFavoritedIds } from '../lib/favoritesApi'
import { STATUS_META } from '../lib/propertyStatus'
import FavoriteButton from '../components/FavoriteButton'
import RequestInspectionButton from '../components/RequestInspectionButton'
import MessageButton from '../components/MessageButton'
import PayButton from '../components/PayButton'
import ReportButton from '../components/ReportButton'
import ShareButton from '../components/ShareButton'
import PropertyListingDetail from '../components/PropertyListingDetail'
import ReviewsSummary from '../components/ReviewsSummary'
import ReviewsList from '../components/ReviewsList'
import PhotoLightbox from '../components/PhotoLightbox'
import useDocumentMeta from '../hooks/useDocumentMeta'

export default function PropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [property, setProperty] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [isFavorited, setIsFavorited] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [siblingUnits, setSiblingUnits] = useState([])

  useDocumentMeta(
    property ? `${property.title} — SettleNG` : 'SettleNG',
    property
      ? `${property.bedrooms != null ? `${property.bedrooms} bed` : 'Property'} in ${property.neighborhood?.name || property.ward?.name || 'Nigeria'} — view full move-in cost and verification on SettleNG.`
      : 'Find verified rentals in Nigeria.',
  )

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

  useEffect(() => {
    if (!user) {
      setIsFavorited(false)
      return
    }
    fetchFavoritedIds().then((ids) => setIsFavorited(ids.has(id)))
  }, [id, user])

  const loadSiblingUnits = async (buildingId) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/buildings/${buildingId}`, {
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    })

    setSiblingUnits(res.ok ? (await res.json())?.units || [] : [])
  }

  useEffect(() => {
    if (!property?.building_id) {
      setSiblingUnits([])
      return
    }

    loadSiblingUnits(property.building_id).catch(() => setSiblingUnits([]))
  }, [property?.building_id])

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
    // of rendering the raw PATCH response. If this unit is part of a
    // building, its own entry in the sibling-unit dropdown just went
    // stale too (still showing its pre-publish status), so refresh
    // that as well.
    await loadProperty()
    if (property?.building_id) {
      loadSiblingUnits(property.building_id).catch(() => {})
    }
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

  return (
    <div className="property-detail-page">
      <div className="property-detail-card">
        <div className="property-detail-header">
          <h1>{property.title}</h1>
          {property.status !== 'available' && (
            <span className="badge-draft">{property.status}</span>
          )}
          <FavoriteButton
            propertyId={property.id}
            initialFavorited={isFavorited}
          />
          <ShareButton propertyId={property.id} />
          <ReportButton targetType="property" targetId={property.id} />
        </div>

        {property.building_id && (
          <div className="property-building-context">
            <Link
              to={`/buildings/${property.building_id}`}
              className="property-building-link"
            >
              Part of {property.building_name}
            </Link>

            {siblingUnits.length > 1 && (
              <select
                className="unit-switcher-select"
                value={property.id}
                onChange={(event) => {
                  const nextId = event.target.value
                  if (nextId !== property.id) navigate(`/properties/${nextId}`)
                }}
                aria-label="Switch to a different unit in this building"
              >
                {siblingUnits.map((unit) => {
                  const meta = STATUS_META[unit.status] || {
                    label: unit.status,
                  }
                  return (
                    <option
                      key={unit.id}
                      value={unit.id}
                      disabled={unit.status !== 'available' && unit.id !== property.id}
                    >
                      {unit.unit_label || 'Unit'} — {meta.label}
                    </option>
                  )
                })}
              </select>
            )}
          </div>
        )}

        <div className="property-owner-block">
          <p className="property-owner-name">
            Owner: {property.owner_name || 'Unknown'}
          </p>
          {property.owner_phone_verified && (
            <span className="badge-verified">🟢 Phone Verified</span>
          )}
          {property.owner_identity_verified && (
            <span className="badge-verified">🟢 Identity Verified</span>
          )}
          {property.ownership_verified && (
            <span className="badge-verified">🟢 Property Verified</span>
          )}
          {!property.owner_phone_verified &&
            !property.owner_identity_verified &&
            !property.ownership_verified && (
              <span className="badge-not-verified">Not yet verified</span>
            )}
          <ReviewsSummary userId={property.owner_id} />
        </div>

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

        <div className="property-inspection-cta">
          <RequestInspectionButton property={property} />
          <MessageButton property={property} />
          <PayButton property={property} />
        </div>

        <PropertyListingDetail
          property={property}
          onImageClick={(index) => setLightboxIndex(index)}
        />

        <h2>Reviews</h2>
        <ReviewsList userId={property.owner_id} />
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          images={property.images.map((image) => image.url)}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

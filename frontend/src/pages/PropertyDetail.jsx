import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchFavoritedIds } from '../lib/favoritesApi'
import FavoriteButton from '../components/FavoriteButton'
import RequestInspectionButton from '../components/RequestInspectionButton'
import MessageButton from '../components/MessageButton'
import ReportButton from '../components/ReportButton'
import PropertyListingDetail from '../components/PropertyListingDetail'
import ReviewsSummary from '../components/ReviewsSummary'
import ReviewsList from '../components/ReviewsList'
import PhotoLightbox from '../components/PhotoLightbox'

export default function PropertyDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const [property, setProperty] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [isFavorited, setIsFavorited] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)

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
          <ReportButton targetType="property" targetId={property.id} />
        </div>

        {property.building_id && (
          <p className="property-building-context">
            Part of{' '}
            <Link to={`/buildings/${property.building_id}`}>
              {property.building_name}
            </Link>
            {property.unit_label && ` — Unit ${property.unit_label}`}
          </p>
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

import { Link, useNavigate } from 'react-router-dom'
import FavoriteButton from './FavoriteButton'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export default function PropertyCard({ property, favorited, onToggleFavorite }) {
  const navigate = useNavigate()
  const unavailable = property.status !== 'available'
  // Same three checks PropertyDetail.jsx uses for its own verification
  // badges — reused here as-is. The list/card API shape doesn't
  // currently join the owner's phone/identity verification (only
  // ownership_verified lives directly on the property row), so in
  // practice only ownership_verified ever lights this up today; it's
  // written to match PropertyDetail's exact condition so it picks up
  // the other two automatically if a future phase adds them here too.
  const isVerified = Boolean(
    property.owner_phone_verified ||
      property.owner_identity_verified ||
      property.ownership_verified,
  )

  return (
    <Link
      to={`/properties/${property.id}`}
      className={'property-card' + (unavailable ? ' property-card-muted' : '')}
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

        <span
          className={
            'property-card-status-badge' +
            (unavailable
              ? ' badge-unavailable'
              : ' badge-available')
          }
        >
          {unavailable ? 'No longer available' : property.status}
        </span>

        <FavoriteButton
          propertyId={property.id}
          initialFavorited={favorited}
          onToggle={onToggleFavorite}
        />

        {isVerified && (
          <span className="property-card-verified-badge" title="Verified">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}

        {property.unit_label && (
          <span className="badge-unit-label">Unit {property.unit_label}</span>
        )}
      </div>
      <div className="property-card-body">
        <h3>{property.title}</h3>
        {property.building_id && (
          <button
            type="button"
            className="property-card-building-link"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              navigate(`/buildings/${property.building_id}`)
            }}
          >
            Part of {property.building_name}
          </button>
        )}
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
}

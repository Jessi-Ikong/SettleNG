import { Link } from 'react-router-dom'
import FavoriteButton from './FavoriteButton'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export default function PropertyCard({ property, favorited, onToggleFavorite }) {
  const unavailable = property.status !== 'available'

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
        <FavoriteButton
          propertyId={property.id}
          initialFavorited={favorited}
          onToggle={onToggleFavorite}
        />
      </div>
      <div className="property-card-body">
        {unavailable ? (
          <span className="badge-unavailable">No longer available</span>
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
}

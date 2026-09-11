import { PRICING_FIELDS, PROPERTY_TYPES } from '../lib/amenities'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

// Read-only listing content shared between the public PropertyDetail
// page and the admin reports queue's inline preview — gallery,
// location, facts, amenities, owner name, and the pricing breakdown.
// Interactive chrome (favorite/report/message/inspect buttons, the
// title header, publish actions) stays with each caller since it
// differs by context.
export default function PropertyListingDetail({ property, ownerName }) {
  const typeLabel =
    PROPERTY_TYPES.find((t) => t.value === property.property_type)?.label ||
    property.property_type

  return (
    <>
      {property.images.length > 0 ? (
        <div className="property-gallery">
          {property.images.map((image) => (
            <img key={image.id} src={image.url} alt={property.title} />
          ))}
        </div>
      ) : (
        <div className="property-gallery-empty">No photos yet</div>
      )}

      <p className="property-type-label">{typeLabel}</p>

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
      {property.street && <p className="property-street">{property.street}</p>}

      {ownerName && <p className="property-owner-name">Owner: {ownerName}</p>}

      {property.description && (
        <p className="property-description">{property.description}</p>
      )}

      <div className="property-facts">
        {property.bedrooms != null && <span>{property.bedrooms} bed</span>}
        {property.bathrooms != null && <span>{property.bathrooms} bath</span>}
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
    </>
  )
}

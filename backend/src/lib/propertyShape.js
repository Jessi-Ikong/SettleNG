export const PRICING_FIELDS = [
  'rent_amount',
  'agency_fee',
  'agreement_fee',
  'caution_fee',
  'service_charge',
  'other_fee',
]

export const LOCATION_JOIN =
  'ward:ward_id(id,name,lga:lga_id(id,name,state:state_id(id,name))),neighborhood:neighborhood_id(id,name)'

export const PROPERTY_CARD_SELECT = `id, title, property_type, bedrooms, bathrooms, status, created_at,
       rent_amount, agency_fee, agreement_fee, caution_fee, service_charge, other_fee,
       ${LOCATION_JOIN},
       property_images(url, sort_order)`

export function computeMoveInCost(property) {
  let total = 0
  let anyProvided = false
  const notProvided = []

  for (const field of PRICING_FIELDS) {
    const value = property[field]
    if (value === null || value === undefined) {
      notProvided.push(field)
    } else {
      total += Number(value)
      anyProvided = true
    }
  }

  return { total: anyProvided ? total : null, notProvided }
}

// Maps a raw properties row (selected with PROPERTY_CARD_SELECT) into
// the flattened card shape used by both GET /api/properties and
// GET /api/favorites, so the frontend can reuse the same card
// component for both.
export function toPropertyCard(property) {
  const images = [...(property.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const { property_images, ...rest } = property
  return {
    ...rest,
    first_image: images[0]?.url ?? null,
    move_in_cost: computeMoveInCost(property),
  }
}

import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'

const router = Router()

const TENANCY_SELECT = `
  id, property_id, landlord_id, started_at, ended_at,
  property:property_id(
    title, bedrooms, bathrooms,
    property_images(url, sort_order),
    ward:ward_id(name, lga:lga_id(name, state:state_id(name))),
    neighborhood:neighborhood_id(name)
  ),
  landlord:landlord_id(full_name)
`

function toTenancyCard(row) {
  const images = [...(row.property?.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  return {
    id: row.id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    property: row.property
      ? {
          id: row.property_id,
          // A tenancy's landlord is always that property's owner —
          // reusing landlord_id here instead of a separate lookup so
          // callers (e.g. Home.jsx's "Message landlord" button) have
          // the owner_id MessageButton needs without another join.
          owner_id: row.landlord_id,
          title: row.property.title,
          bedrooms: row.property.bedrooms,
          bathrooms: row.property.bathrooms,
          first_image: images[0]?.url ?? null,
          neighborhood: row.property.neighborhood,
          ward: row.property.ward,
        }
      : null,
    landlord_name: row.landlord?.full_name ?? null,
  }
}

router.use(requireAuth)
router.use(generalApiLimiter)

router.get('/mine', async (req, res) => {
  const { data, error } = await supabase
    .from('tenancies')
    .select(TENANCY_SELECT)
    .eq('tenant_id', req.profile.id)
    .order('started_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ items: data.map(toTenancyCard) })
})

export default router

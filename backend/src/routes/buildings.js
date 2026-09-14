import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { findOrCreateNeighborhood } from '../lib/neighborhoods.js'
import {
  LOCATION_JOIN,
  PROPERTY_CARD_SELECT,
  toPropertyCard,
} from '../lib/propertyShape.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : Math.trunc(num)
}

router.post('/', requireAuth, async (req, res) => {
  if (!['landlord', 'agent'].includes(req.profile.role)) {
    return res.status(403).json({
      error: 'Only landlords or agents can create buildings',
    })
  }

  const body = req.body || {}

  if (!body.name) {
    return res.status(400).json({ error: 'name is required' })
  }

  const wardId = toNullableInt(body.ward_id)
  if (!wardId) {
    return res.status(400).json({ error: 'ward_id is required' })
  }

  let neighborhoodId = toNullableInt(body.neighborhood_id)

  if (!neighborhoodId && body.neighborhood_name) {
    try {
      neighborhoodId = await findOrCreateNeighborhood(
        wardId,
        body.neighborhood_name,
        req.profile.id,
      )
    } catch (error) {
      return res.status(500).json({ error: error.message })
    }
  }

  if (!neighborhoodId) {
    return res
      .status(400)
      .json({ error: 'neighborhood_id or neighborhood_name is required' })
  }

  const payload = {
    name: body.name,
    description: body.description || null,
    ward_id: wardId,
    neighborhood_id: neighborhoodId,
    street: body.street || null,
    total_units: toNullableInt(body.total_units),
    owner_id: req.profile.id,
  }

  const { data, error } = await supabase
    .from('buildings')
    .insert(payload)
    .select(`*, ${LOCATION_JOIN}`)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(data)
})

router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Building ${id} not found` })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('buildings')
    .select('id, owner_id, ward_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to look up building' })
  }
  if (!existing) {
    return res.status(404).json({ error: `Building ${id} not found` })
  }
  if (existing.owner_id !== req.profile.id) {
    return res.status(403).json({ error: 'You do not own this building' })
  }

  const body = req.body || {}
  const payload = {}

  if ('name' in body) payload.name = body.name
  if ('description' in body) payload.description = body.description || null
  if ('street' in body) payload.street = body.street || null
  if ('total_units' in body) {
    payload.total_units = toNullableInt(body.total_units)
  }

  if (
    'ward_id' in body ||
    'neighborhood_id' in body ||
    'neighborhood_name' in body
  ) {
    const wardId = 'ward_id' in body ? toNullableInt(body.ward_id) : existing.ward_id
    if ('ward_id' in body) payload.ward_id = wardId

    let neighborhoodId = toNullableInt(body.neighborhood_id)

    if (!neighborhoodId && body.neighborhood_name) {
      if (!wardId) {
        return res.status(400).json({
          error: 'ward_id is required when setting neighborhood_name',
        })
      }
      try {
        neighborhoodId = await findOrCreateNeighborhood(
          wardId,
          body.neighborhood_name,
          req.profile.id,
        )
      } catch (error) {
        return res.status(500).json({ error: error.message })
      }
    }

    if (neighborhoodId) payload.neighborhood_id = neighborhoodId
  }

  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('buildings')
    .update(payload)
    .eq('id', id)
    .select(`*, ${LOCATION_JOIN}`)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

router.get('/', requireAuth, async (req, res) => {
  if (String(req.query.mine) !== 'true') {
    return res.status(400).json({ error: 'mine=true is required' })
  }

  const { data, error } = await supabase
    .from('buildings')
    .select(`*, ${LOCATION_JOIN}`)
    .eq('owner_id', req.profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Real unit counts per building, same "actual count, not the
  // manually-entered total_units" principle as the detail endpoint —
  // one extra query for all of them rather than N+1.
  const buildingIds = data.map((b) => b.id)
  const countsByBuilding = {}

  if (buildingIds.length > 0) {
    const { data: unitRows, error: unitsError } = await supabase
      .from('properties')
      .select('building_id, status')
      .in('building_id', buildingIds)

    if (unitsError) {
      return res.status(500).json({ error: unitsError.message })
    }

    for (const row of unitRows) {
      const counts = countsByBuilding[row.building_id] || {
        total: 0,
        available: 0,
      }
      counts.total += 1
      if (row.status === 'available') counts.available += 1
      countsByBuilding[row.building_id] = counts
    }
  }

  const items = data.map((building) => ({
    ...building,
    total_units_count: countsByBuilding[building.id]?.total ?? 0,
    available_units_count: countsByBuilding[building.id]?.available ?? 0,
  }))

  res.json({ items })
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Building ${id} not found` })
  }

  const { data: building, error } = await supabase
    .from('buildings')
    .select(`*, ${LOCATION_JOIN}`)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const { data: unitRows, error: unitsError } = await supabase
    .from('properties')
    .select(PROPERTY_CARD_SELECT)
    .eq('building_id', id)
    .order('unit_label', { ascending: true })

  if (unitsError) {
    return res.status(500).json({ error: unitsError.message })
  }

  const allUnits = (unitRows || []).map(toPropertyCard)

  // This endpoint is public (no auth required), and the backend uses
  // the service-role key which bypasses RLS — so we replicate the
  // same "at least one available unit, or you own it" visibility rule
  // from the buildings RLS policy here in application code, same
  // pattern as GET /api/properties/:id.
  let isOwner = false
  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Bearer ') && building) {
    const token = authHeader.slice('Bearer '.length)
    const { data: authData } = await supabase.auth.getUser(token)
    if (authData?.user?.id === building.owner_id) {
      isOwner = true
    }
  }

  const hasAvailableUnit = allUnits.some((u) => u.status === 'available')

  if (!building || (!hasAvailableUnit && !isOwner)) {
    return res.status(404).json({ error: `Building ${id} not found` })
  }

  // A non-owner sees every unit that has ever been public — available,
  // rented, unavailable, suspended, pending — since the whole point of
  // this list (and the property-page unit switcher built on top of
  // it) is showing the full picture of which units are open and which
  // aren't. Only 'draft' units are held back from non-owners, same as
  // every other draft-hides-from-the-public rule in the app; the
  // owner sees every unit regardless of status, same as My Properties
  // does. The counts below are always the real totals, not filtered
  // by viewer — that's the whole point of surfacing them.
  const visibleUnits = isOwner
    ? allUnits
    : allUnits.filter((u) => u.status !== 'draft')

  res.json({
    ...building,
    units: visibleUnits,
    available_units_count: allUnits.filter((u) => u.status === 'available')
      .length,
    total_units_count: allUnits.length,
  })
})

export default router

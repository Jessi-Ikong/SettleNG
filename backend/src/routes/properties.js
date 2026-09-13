import { randomUUID } from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import {
  PRICING_FIELDS,
  LOCATION_JOIN,
  PROPERTY_CARD_SELECT,
  computeMoveInCost,
  toPropertyCard,
} from '../lib/propertyShape.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

const EDITABLE_FIELDS = [
  'title',
  'description',
  'property_type',
  'bedrooms',
  'bathrooms',
  'toilets',
  'furnished',
  'amenities',
  'ward_id',
  'street',
  ...PRICING_FIELDS,
]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

function toNullableInt(value) {
  const num = toNullableNumber(value)
  return num === null ? null : Math.trunc(num)
}

async function findOrCreateNeighborhood(wardId, name, createdBy) {
  const trimmed = name.trim()

  const { data: existing, error: findError } = await supabase
    .from('neighborhoods')
    .select('id')
    .eq('ward_id', wardId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (findError) {
    throw new Error(`Failed to look up neighborhood: ${findError.message}`)
  }

  if (existing) return existing.id

  const { data: created, error: createError } = await supabase
    .from('neighborhoods')
    .insert({ ward_id: wardId, name: trimmed, created_by: createdBy })
    .select('id')
    .single()

  if (createError) {
    // Race: someone else created the same (ward_id, name) between our
    // select and insert — fall back to re-selecting it.
    if (createError.code === '23505') {
      const { data: retry } = await supabase
        .from('neighborhoods')
        .select('id')
        .eq('ward_id', wardId)
        .ilike('name', trimmed)
        .maybeSingle()
      if (retry) return retry.id
    }
    throw new Error(`Failed to create neighborhood: ${createError.message}`)
  }

  return created.id
}

function buildPropertyPayload(body) {
  const payload = {}

  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue

    if (PRICING_FIELDS.includes(field)) {
      payload[field] = toNullableNumber(body[field])
    } else if (['bedrooms', 'bathrooms', 'toilets'].includes(field)) {
      payload[field] = toNullableInt(body[field])
    } else if (field === 'ward_id') {
      payload[field] = toNullableInt(body[field])
    } else if (field === 'amenities') {
      payload[field] = Array.isArray(body.amenities) ? body.amenities : []
    } else {
      payload[field] = body[field]
    }
  }

  return payload
}

const PROPERTY_TYPE_VALUES = [
  'self_contained',
  'room_and_parlour',
  '1_bedroom',
  '2_bedroom',
  '3_bedroom',
  '4plus_bedroom',
  'duplex',
  'bungalow',
  'detached_house',
  'semi_detached_house',
  'shared_accommodation',
  'studio',
  'serviced_apartment',
  'other',
]

const FURNISHED_VALUES = ['furnished', 'unfurnished', 'partly_furnished']

const SORT_VALUES = ['newest', 'oldest', 'price_low', 'price_high']

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === '') return null
  if (!/^\d+$/.test(String(value))) return null
  return parseInt(value, 10)
}

function parseNonNegativeNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) return null
  return num
}

// Resolves a location query into either a specific neighborhood_id
// filter, or a list of ward_ids to filter by — using whichever of
// neighborhood_id/ward_id/lga_id/state_id is most specific. Combining
// a broader level with a narrower one (e.g. state_id + ward_id) just
// narrows to the more specific one, since a ward already implies a
// single lga/state.
async function resolveLocationFilter(query) {
  const neighborhoodId = parsePositiveInt(query.neighborhood_id)
  if (neighborhoodId) return { type: 'neighborhood', neighborhoodId }

  const wardId = parsePositiveInt(query.ward_id)
  if (wardId) return { type: 'wards', wardIds: [wardId] }

  const lgaId = parsePositiveInt(query.lga_id)
  if (lgaId) {
    const { data } = await supabase
      .from('wards')
      .select('id')
      .eq('lga_id', lgaId)
    return { type: 'wards', wardIds: (data || []).map((w) => w.id) }
  }

  const stateId = parsePositiveInt(query.state_id)
  if (stateId) {
    const { data: lgas } = await supabase
      .from('lgas')
      .select('id')
      .eq('state_id', stateId)
    const lgaIds = (lgas || []).map((l) => l.id)
    if (lgaIds.length === 0) return { type: 'wards', wardIds: [] }

    const { data: wards } = await supabase
      .from('wards')
      .select('id')
      .in('lga_id', lgaIds)
    return { type: 'wards', wardIds: (wards || []).map((w) => w.id) }
  }

  return { type: 'none' }
}

router.post('/', requireAuth, async (req, res) => {
  if (!['landlord', 'agent'].includes(req.profile.role)) {
    return res.status(403).json({
      error: 'Only landlords or agents can create property listings',
    })
  }

  const body = req.body || {}

  if (!body.title) {
    return res.status(400).json({ error: 'title is required' })
  }
  if (!body.property_type) {
    return res.status(400).json({ error: 'property_type is required' })
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
    ...buildPropertyPayload(body),
    ward_id: wardId,
    neighborhood_id: neighborhoodId,
    owner_id: req.profile.id,
    status: 'draft',
  }

  const { data, error } = await supabase
    .from('properties')
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
    return res.status(404).json({ error: `Property ${id} not found` })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('properties')
    .select('id, owner_id, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to look up property' })
  }
  if (!existing) {
    return res.status(404).json({ error: `Property ${id} not found` })
  }
  if (existing.owner_id !== req.profile.id && req.profile.role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'You do not own this property' })
  }

  const body = req.body || {}
  const payload = buildPropertyPayload(body)

  // Marking a property rented with a specific tenant: verify that
  // tenant actually has a completed/accepted inspection on THIS
  // property before we let the owner attach them as the tenant — an
  // owner could otherwise name any random user_id in the body.
  const assigningTenant = body.status === 'rented' && body.tenant_id
  if (assigningTenant) {
    if (!UUID_RE.test(body.tenant_id)) {
      return res.status(400).json({ error: 'A valid tenant_id is required' })
    }

    const { data: eligibleInspection, error: inspectionError } =
      await supabase
        .from('inspections')
        .select('id')
        .eq('property_id', id)
        .eq('tenant_id', body.tenant_id)
        .in('status', ['accepted', 'completed'])
        .limit(1)
        .maybeSingle()

    if (inspectionError) {
      return res
        .status(500)
        .json({ error: 'Failed to verify tenant eligibility' })
    }
    if (!eligibleInspection) {
      return res.status(400).json({
        error:
          'This tenant has no completed or accepted inspection on this property',
      })
    }
  }

  if ('neighborhood_id' in body || 'neighborhood_name' in body) {
    let neighborhoodId = toNullableInt(body.neighborhood_id)
    const wardId = 'ward_id' in payload ? payload.ward_id : undefined

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

  if (body.status) {
    payload.status = body.status
  }

  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('properties')
    .update(payload)
    .eq('id', id)
    .select(`*, ${LOCATION_JOIN}`)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (assigningTenant) {
    const { error: tenancyError } = await supabase.from('tenancies').insert({
      property_id: id,
      tenant_id: body.tenant_id,
      landlord_id: existing.owner_id,
    })
    if (tenancyError) {
      return res.status(500).json({ error: tenancyError.message })
    }
  } else if (
    existing.status === 'rented' &&
    body.status &&
    body.status !== 'rented'
  ) {
    const { data: activeTenancy, error: activeTenancyError } = await supabase
      .from('tenancies')
      .select('id')
      .eq('property_id', id)
      .is('ended_at', null)
      .maybeSingle()

    if (activeTenancyError) {
      return res.status(500).json({ error: activeTenancyError.message })
    }

    if (activeTenancy) {
      const { error: endTenancyError } = await supabase
        .from('tenancies')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', activeTenancy.id)

      if (endTenancyError) {
        return res.status(500).json({ error: endTenancyError.message })
      }
    }
  }

  res.json(data)
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Property ${id} not found` })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to look up property' })
  }
  if (!existing) {
    return res.status(404).json({ error: `Property ${id} not found` })
  }
  if (existing.owner_id !== req.profile.id) {
    return res
      .status(403)
      .json({ error: 'You do not own this property' })
  }

  const { data, error } = await supabase
    .from('properties')
    .update({ status: 'unavailable', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

router.get('/', async (req, res) => {
  const q = req.query

  const page = Math.max(1, parsePositiveInt(q.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(q.limit) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  if (String(q.mine) === 'true') {
    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const token = authHeader.slice('Bearer '.length)
    const { data: authData, error: authError } =
      await supabase.auth.getUser(token)

    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // "My properties" ignores every Phase 4 search filter/sort — it's
    // an owner's own inventory, not a public search.
    const {
      data,
      error,
      count,
    } = await supabase
      .from('properties')
      .select(PROPERTY_CARD_SELECT, { count: 'exact' })
      .eq('owner_id', authData.user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({
      items: data.map(toPropertyCard),
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    })
  }

  const locationFilter = await resolveLocationFilter(q)

  // A resolved-but-empty ward list (e.g. a state/lga with no wards)
  // can never match anything — short-circuit instead of sending
  // `.in('ward_id', [])`, which PostgREST doesn't handle predictably.
  if (locationFilter.type === 'wards' && locationFilter.wardIds.length === 0) {
    return res.json({ items: [], page, pageSize, total: 0, totalPages: 0 })
  }

  let query = supabase
    .from('properties')
    .select(PROPERTY_CARD_SELECT, { count: 'exact' })
    .eq('status', 'available')

  if (locationFilter.type === 'neighborhood') {
    query = query.eq('neighborhood_id', locationFilter.neighborhoodId)
  } else if (locationFilter.type === 'wards') {
    query = query.in('ward_id', locationFilter.wardIds)
  }

  if (
    q.property_type &&
    PROPERTY_TYPE_VALUES.includes(String(q.property_type))
  ) {
    query = query.eq('property_type', q.property_type)
  }

  if (q.furnished && FURNISHED_VALUES.includes(String(q.furnished))) {
    query = query.eq('furnished', q.furnished)
  }

  const minPrice = parseNonNegativeNumber(q.min_price)
  if (minPrice !== null) query = query.gte('rent_amount', minPrice)

  const maxPrice = parseNonNegativeNumber(q.max_price)
  if (maxPrice !== null) query = query.lte('rent_amount', maxPrice)

  const bedrooms = parsePositiveInt(q.bedrooms)
  if (bedrooms !== null) {
    query =
      bedrooms >= 4
        ? query.gte('bedrooms', 4)
        : query.eq('bedrooms', bedrooms)
  }

  if (q.amenities) {
    const amenities = String(q.amenities)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
    if (amenities.length > 0) {
      query = query.contains('amenities', amenities)
    }
  }

  const sort = SORT_VALUES.includes(String(q.sort)) ? q.sort : 'newest'
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true })
  } else if (sort === 'price_low') {
    query = query.order('rent_amount', { ascending: true, nullsFirst: false })
  } else if (sort === 'price_high') {
    query = query.order('rent_amount', {
      ascending: false,
      nullsFirst: false,
    })
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = data.map(toPropertyCard)

  res.json({
    items,
    page,
    pageSize,
    total: count,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Property ${id} not found` })
  }

  const { data: property, error } = await supabase
    .from('properties')
    .select(
      `*, ${LOCATION_JOIN}, property_images(id, url, sort_order), owner:owner_id(full_name, phone_verified, identity_verified)`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // This endpoint is public (no auth required), and the backend uses
  // the service-role key which bypasses RLS — so we replicate the
  // same "available, or you own it, or you're an admin" visibility
  // rule from the properties RLS policy here in application code. A
  // token is optional: if one is present and it resolves to the
  // owner or an admin, they can view a non-available (e.g. draft or
  // suspended) listing too.
  let isOwner = false
  let isAdmin = false
  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Bearer ') && property) {
    const token = authHeader.slice('Bearer '.length)
    const { data: authData } = await supabase.auth.getUser(token)
    if (authData?.user?.id === property.owner_id) {
      isOwner = true
    } else if (authData?.user) {
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle()
      isAdmin = viewerProfile?.role === 'admin'
    }
  }

  if (!property || (property.status !== 'available' && !isOwner && !isAdmin)) {
    return res.status(404).json({ error: `Property ${id} not found` })
  }

  const images = [...(property.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  const { owner, ...propertyFields } = property

  // The tenant-assignment picker on "Mark as rented" needs this list
  // while the property is still 'available' (about to be rented), and
  // it stays useful to re-check once 'rented' too — so it's computed
  // for the owner in either state, never for a public/tenant viewer.
  let eligibleTenants
  if (isOwner && ['available', 'rented'].includes(property.status)) {
    const { data: eligibleRows, error: eligibleError } = await supabase
      .from('inspections')
      .select('tenant_id, tenant:tenant_id(full_name)')
      .eq('property_id', id)
      .in('status', ['accepted', 'completed'])

    if (eligibleError) {
      return res.status(500).json({ error: eligibleError.message })
    }

    const seen = new Map()
    for (const row of eligibleRows) {
      if (!seen.has(row.tenant_id)) {
        seen.set(row.tenant_id, {
          id: row.tenant_id,
          full_name: row.tenant?.full_name ?? null,
        })
      }
    }
    eligibleTenants = [...seen.values()]
  }

  res.json({
    ...propertyFields,
    images,
    move_in_cost: computeMoveInCost(property),
    // Shown to every viewer (not just the owner/an admin) so a
    // prospective tenant can see who they'd be dealing with and look
    // up that landlord's reviews — the whole point of this field.
    owner_name: owner?.full_name ?? null,
    owner_phone_verified: owner?.phone_verified ?? false,
    owner_identity_verified: owner?.identity_verified ?? false,
    ...(eligibleTenants ? { eligible_tenants: eligibleTenants } : {}),
  })
})

router.post(
  '/:id/images',
  requireAuth,
  upload.array('images'),
  async (req, res) => {
    const { id } = req.params

    if (!UUID_RE.test(id)) {
      return res.status(404).json({ error: `Property ${id} not found` })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('properties')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return res.status(500).json({ error: 'Failed to look up property' })
    }
    if (!existing) {
      return res.status(404).json({ error: `Property ${id} not found` })
    }
    if (existing.owner_id !== req.profile.id) {
      return res
        .status(403)
        .json({ error: 'You do not own this property' })
    }

    const files = req.files || []
    if (files.length === 0) {
      return res.status(400).json({ error: 'No images provided' })
    }

    const uploaded = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = `${id}/${randomUUID()}-${file.originalname}`

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(path, file.buffer, { contentType: file.mimetype })

      if (uploadError) {
        return res.status(500).json({ error: uploadError.message })
      }

      const { data: publicUrlData } = supabase.storage
        .from('property-images')
        .getPublicUrl(path)

      uploaded.push({
        property_id: id,
        url: publicUrlData.publicUrl,
        sort_order: i,
      })
    }

    const { data, error } = await supabase
      .from('property_images')
      .insert(uploaded)
      .select()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json(data)
  },
)

export default router

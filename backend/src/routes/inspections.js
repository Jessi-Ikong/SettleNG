import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const INSPECTION_JOIN = `
  id, property_id, tenant_id, owner_id, status, requested_date, requested_time, note,
  owner_response_note, created_at, updated_at,
  property:property_id(
    title,
    property_images(url, sort_order),
    ward:ward_id(name, lga:lga_id(name, state:state_id(name)))
  ),
  tenant:tenant_id(full_name),
  owner:owner_id(full_name)
`

// Maps "<currentStatus>->newStatus" to which caller role may make that
// transition, and whether it requires extra fields in the body.
const TRANSITIONS = {
  'requested->accepted': { caller: 'owner' },
  'requested->rejected': { caller: 'owner', requiresOwnerNote: true },
  'requested->rescheduled': {
    caller: 'owner',
    requiresOwnerNote: true,
    requiresNewDateTime: true,
  },
  'accepted->rescheduled': {
    caller: 'owner',
    requiresOwnerNote: true,
    requiresNewDateTime: true,
  },
  'accepted->completed': { caller: 'owner' },
  'accepted->no_show': { caller: 'owner' },
  'requested->cancelled': { caller: 'tenant' },
  'accepted->cancelled': { caller: 'tenant' },
  'rescheduled->accepted': { caller: 'tenant' },
  'rescheduled->cancelled': { caller: 'tenant' },
}

function toInspectionCard(row, viewerRole) {
  const images = [...(row.property?.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  return {
    id: row.id,
    property_id: row.property_id,
    status: row.status,
    requested_date: row.requested_date,
    requested_time: row.requested_time,
    note: row.note,
    owner_response_note: row.owner_response_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    property: row.property
      ? {
          title: row.property.title,
          first_image: images[0]?.url ?? null,
          ward: row.property.ward,
        }
      : null,
    other_party_name:
      viewerRole === 'tenant'
        ? row.owner?.full_name ?? null
        : row.tenant?.full_name ?? null,
    other_party_id: viewerRole === 'tenant' ? row.owner_id : row.tenant_id,
  }
}

router.use(requireAuth)
router.use(generalApiLimiter)

router.post('/', async (req, res) => {
  const { property_id, requested_date, requested_time, note } =
    req.body || {}

  if (!property_id || !UUID_RE.test(property_id)) {
    return res.status(400).json({ error: 'A valid property_id is required' })
  }
  if (!requested_date) {
    return res.status(400).json({ error: 'requested_date is required' })
  }
  if (!requested_time) {
    return res.status(400).json({ error: 'requested_time is required' })
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, owner_id, status')
    .eq('id', property_id)
    .maybeSingle()

  if (propertyError) {
    return res.status(500).json({ error: 'Failed to look up property' })
  }
  if (!property) {
    return res.status(400).json({ error: `Property ${property_id} not found` })
  }
  if (property.status !== 'available') {
    return res
      .status(400)
      .json({ error: 'This property is not available for inspection' })
  }
  if (property.owner_id === req.profile.id) {
    return res
      .status(400)
      .json({ error: "You can't request an inspection on your own listing" })
  }

  const { data, error } = await supabase
    .from('inspections')
    .insert({
      property_id,
      tenant_id: req.profile.id,
      owner_id: property.owner_id,
      requested_date,
      requested_time,
      note: note || null,
    })
    .select(INSPECTION_JOIN)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(toInspectionCard(data, 'tenant'))
})

router.get('/', async (req, res) => {
  const role = req.query.role

  if (role !== 'tenant' && role !== 'owner') {
    return res
      .status(400)
      .json({ error: 'role query param must be "tenant" or "owner"' })
  }

  const column = role === 'tenant' ? 'tenant_id' : 'owner_id'

  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_JOIN)
    .eq(column, req.profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ items: data.map((row) => toInspectionCard(row, role)) })
})

router.patch('/:id', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Inspection ${id} not found` })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to look up inspection' })
  }
  if (!existing) {
    return res.status(404).json({ error: `Inspection ${id} not found` })
  }

  const isTenant = existing.tenant_id === req.profile.id
  const isOwner = existing.owner_id === req.profile.id

  if (!isTenant && !isOwner) {
    return res
      .status(403)
      .json({ error: 'You are not part of this inspection' })
  }

  const callerRole = isOwner ? 'owner' : 'tenant'
  const body = req.body || {}
  const newStatus = body.status

  const validStatuses = [
    'requested',
    'accepted',
    'rejected',
    'rescheduled',
    'cancelled',
    'completed',
    'no_show',
  ]
  if (!newStatus || !validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: 'A valid status is required' })
  }

  const transitionKey = `${existing.status}->${newStatus}`
  const transition = TRANSITIONS[transitionKey]

  if (!transition || transition.caller !== callerRole) {
    return res.status(400).json({
      error: `Cannot go from "${existing.status}" to "${newStatus}" as the ${callerRole}`,
    })
  }

  if (transition.requiresOwnerNote && !body.owner_response_note) {
    return res
      .status(400)
      .json({ error: 'owner_response_note is required for this action' })
  }

  if (
    transition.requiresNewDateTime &&
    (!body.requested_date || !body.requested_time)
  ) {
    return res.status(400).json({
      error: 'requested_date and requested_time are required to propose a new time',
    })
  }

  const payload = { status: newStatus, updated_at: new Date().toISOString() }

  if (body.owner_response_note) {
    payload.owner_response_note = body.owner_response_note
  }
  if (transition.requiresNewDateTime) {
    payload.requested_date = body.requested_date
    payload.requested_time = body.requested_time
  }

  const { data, error } = await supabase
    .from('inspections')
    .update(payload)
    .eq('id', id)
    .select(INSPECTION_JOIN)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(toInspectionCard(data, callerRole))
})

export default router

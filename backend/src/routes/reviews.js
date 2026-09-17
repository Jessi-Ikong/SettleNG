import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RATING_FIELDS = [
  'communication_rating',
  'professionalism_rating',
  'honesty_rating',
  'inspection_experience_rating',
]

const REVIEW_JOIN = `
  id, inspection_id, reviewer_id, reviewee_id, property_id,
  communication_rating, professionalism_rating, honesty_rating,
  inspection_experience_rating, comment, created_at,
  reviewer:reviewer_id(full_name),
  property:property_id(title)
`

function isValidRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

function toReviewCard(row) {
  return {
    id: row.id,
    inspection_id: row.inspection_id,
    property_id: row.property_id,
    property_title: row.property?.title ?? null,
    reviewer_name: row.reviewer?.full_name ?? null,
    communication_rating: row.communication_rating,
    professionalism_rating: row.professionalism_rating,
    honesty_rating: row.honesty_rating,
    inspection_experience_rating: row.inspection_experience_rating,
    comment: row.comment,
    created_at: row.created_at,
  }
}

router.post('/', requireAuth, generalApiLimiter, async (req, res) => {
  const body = req.body || {}
  const { inspection_id: inspectionId, comment } = body

  if (!inspectionId || !UUID_RE.test(inspectionId)) {
    return res.status(400).json({ error: 'A valid inspection_id is required' })
  }

  for (const field of RATING_FIELDS) {
    if (!isValidRating(body[field])) {
      return res
        .status(400)
        .json({ error: `${field} must be an integer between 1 and 5` })
    }
  }

  const { data: inspection, error: inspectionError } = await supabase
    .from('inspections')
    .select('id, tenant_id, owner_id, property_id, status')
    .eq('id', inspectionId)
    .maybeSingle()

  if (inspectionError) {
    return res.status(500).json({ error: 'Failed to look up inspection' })
  }
  if (!inspection) {
    return res.status(404).json({ error: `Inspection ${inspectionId} not found` })
  }
  if (inspection.tenant_id !== req.profile.id) {
    return res
      .status(403)
      .json({ error: 'Only the tenant on this inspection can leave a review' })
  }
  if (inspection.status !== 'completed') {
    return res
      .status(400)
      .json({ error: 'This inspection must be completed before it can be reviewed' })
  }

  const { data: existing, error: existingError } = await supabase
    .from('reviews')
    .select('id')
    .eq('inspection_id', inspectionId)
    .maybeSingle()

  if (existingError) {
    return res.status(500).json({ error: 'Failed to look up existing review' })
  }
  if (existing) {
    return res
      .status(409)
      .json({ error: 'A review already exists for this inspection' })
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      inspection_id: inspectionId,
      reviewer_id: req.profile.id,
      reviewee_id: inspection.owner_id,
      property_id: inspection.property_id,
      communication_rating: body.communication_rating,
      professionalism_rating: body.professionalism_rating,
      honesty_rating: body.honesty_rating,
      inspection_experience_rating: body.inspection_experience_rating,
      comment: comment ? String(comment).trim() || null : null,
    })
    .select(REVIEW_JOIN)
    .single()

  if (error) {
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ error: 'A review already exists for this inspection' })
    }
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(toReviewCard(data))
})

router.get('/user/:userId', generalApiLimiter, async (req, res) => {
  const { userId } = req.params

  if (!UUID_RE.test(userId)) {
    return res.status(404).json({ error: `User ${userId} not found` })
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_JOIN)
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = data.map(toReviewCard)
  const count = items.length

  const averages = {}
  for (const field of RATING_FIELDS) {
    averages[field] =
      count > 0
        ? items.reduce((sum, r) => sum + r[field], 0) / count
        : null
  }

  const overall =
    count > 0
      ? RATING_FIELDS.reduce((sum, field) => sum + averages[field], 0) /
        RATING_FIELDS.length
      : null

  res.json({
    items,
    summary: {
      count,
      overall_average: overall,
      communication_average: averages.communication_rating,
      professionalism_average: averages.professionalism_rating,
      honesty_average: averages.honesty_rating,
      inspection_experience_average: averages.inspection_experience_rating,
    },
  })
})

router.get('/eligible', requireAuth, generalApiLimiter, async (req, res) => {
  const { data: inspections, error } = await supabase
    .from('inspections')
    .select(
      `
      id, property_id, updated_at,
      property:property_id(title, property_images(url, sort_order)),
      owner:owner_id(full_name)
    `,
    )
    .eq('tenant_id', req.profile.id)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (inspections.length === 0) {
    return res.json({ items: [] })
  }

  const { data: reviewed, error: reviewedError } = await supabase
    .from('reviews')
    .select('inspection_id')
    .in('inspection_id', inspections.map((i) => i.id))

  if (reviewedError) {
    return res.status(500).json({ error: reviewedError.message })
  }

  const reviewedIds = new Set(reviewed.map((r) => r.inspection_id))

  const items = inspections
    .filter((i) => !reviewedIds.has(i.id))
    .map((i) => {
      const images = [...(i.property?.property_images || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      return {
        inspection_id: i.id,
        property_id: i.property_id,
        property_title: i.property?.title ?? null,
        property_first_image: images[0]?.url ?? null,
        owner_name: i.owner?.full_name ?? null,
        completed_at: i.updated_at,
      }
    })

  res.json({ items })
})

export default router

import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'
import { PROPERTY_CARD_SELECT, toPropertyCard } from '../lib/propertyShape.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

router.use(requireAuth)
router.use(generalApiLimiter)

router.post('/', async (req, res) => {
  const propertyId = req.body?.property_id

  if (!propertyId || !UUID_RE.test(propertyId)) {
    return res.status(400).json({ error: 'A valid property_id is required' })
  }

  const { data: existing, error: findError } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', req.profile.id)
    .eq('property_id', propertyId)
    .maybeSingle()

  if (findError) {
    return res.status(500).json({ error: findError.message })
  }

  if (existing) {
    return res.status(200).json({ favorited: true })
  }

  const { error: insertError } = await supabase.from('favorites').insert({
    user_id: req.profile.id,
    property_id: propertyId,
  })

  if (insertError) {
    // Race with a concurrent request for the same favorite — treat the
    // same as already-favorited rather than erroring.
    if (insertError.code === '23505') {
      return res.status(200).json({ favorited: true })
    }
    // Foreign key violation means the property doesn't exist.
    if (insertError.code === '23503') {
      return res.status(404).json({ error: `Property ${propertyId} not found` })
    }
    return res.status(500).json({ error: insertError.message })
  }

  res.status(201).json({ favorited: true })
})

router.delete('/:propertyId', async (req, res) => {
  const { propertyId } = req.params

  if (!UUID_RE.test(propertyId)) {
    return res.status(200).json({ favorited: false })
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', req.profile.id)
    .eq('property_id', propertyId)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.status(200).json({ favorited: false })
})

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('favorites')
    .select(`property_id, created_at, properties(${PROPERTY_CARD_SELECT})`)
    .eq('user_id', req.profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = data
    .filter((row) => row.properties)
    .map((row) => toPropertyCard(row.properties))

  res.json({ items, total: items.length })
})

export default router

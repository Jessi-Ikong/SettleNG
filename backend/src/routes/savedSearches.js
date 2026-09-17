import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'

const router = Router()

router.use(requireAuth)
router.use(generalApiLimiter)

router.post('/', async (req, res) => {
  const { name, filters } = req.body || {}

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return res.status(400).json({ error: 'filters must be an object' })
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ user_id: req.profile.id, name: name.trim(), filters })
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json(data)
})

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', req.profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params

  if (!/^\d+$/.test(id)) {
    return res.status(404).json({ error: `Saved search ${id} not found` })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('saved_searches')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to look up saved search' })
  }
  if (!existing) {
    return res.status(404).json({ error: `Saved search ${id} not found` })
  }
  if (existing.user_id !== req.profile.id) {
    return res.status(403).json({ error: 'You do not own this saved search' })
  }

  const { error } = await supabase.from('saved_searches').delete().eq('id', id)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.status(200).json({ deleted: true })
})

export default router

import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'

const router = Router()

router.get('/states', async (req, res) => {
  const { data, error } = await supabase
    .from('states')
    .select('id, name, active')
    .order('name', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch states' })
  }

  res.json(data)
})

router.get('/states/:stateId/lgas', async (req, res) => {
  const { stateId } = req.params

  if (!/^\d+$/.test(stateId)) {
    return res.status(404).json({ error: `State ${stateId} not found` })
  }

  const { data: state, error: stateError } = await supabase
    .from('states')
    .select('id')
    .eq('id', stateId)
    .maybeSingle()

  if (stateError) {
    return res.status(500).json({ error: 'Failed to look up state' })
  }

  if (!state) {
    return res.status(404).json({ error: `State ${stateId} not found` })
  }

  const { data, error } = await supabase
    .from('lgas')
    .select('id, name')
    .eq('state_id', stateId)
    .order('name', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch LGAs' })
  }

  res.json(data)
})

router.get('/lgas/:lgaId/wards', async (req, res) => {
  const { lgaId } = req.params

  if (!/^\d+$/.test(lgaId)) {
    return res.status(404).json({ error: `LGA ${lgaId} not found` })
  }

  const { data: lga, error: lgaError } = await supabase
    .from('lgas')
    .select('id')
    .eq('id', lgaId)
    .maybeSingle()

  if (lgaError) {
    return res.status(500).json({ error: 'Failed to look up LGA' })
  }

  if (!lga) {
    return res.status(404).json({ error: `LGA ${lgaId} not found` })
  }

  const { data, error } = await supabase
    .from('wards')
    .select('id, name, latitude, longitude')
    .eq('lga_id', lgaId)
    .order('name', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch wards' })
  }

  res.json(data)
})

router.get('/wards/:wardId/neighborhoods', async (req, res) => {
  const { wardId } = req.params

  if (!/^\d+$/.test(wardId)) {
    return res.status(404).json({ error: `Ward ${wardId} not found` })
  }

  const { data: ward, error: wardError } = await supabase
    .from('wards')
    .select('id')
    .eq('id', wardId)
    .maybeSingle()

  if (wardError) {
    return res.status(500).json({ error: 'Failed to look up ward' })
  }

  if (!ward) {
    return res.status(404).json({ error: `Ward ${wardId} not found` })
  }

  const { data, error } = await supabase
    .from('neighborhoods')
    .select('id, name')
    .eq('ward_id', wardId)
    .order('name', { ascending: true })

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch neighborhoods' })
  }

  res.json(data)
})

export default router

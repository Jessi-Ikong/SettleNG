import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { logAdminAction } from '../lib/auditLog.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TARGET_TYPES = ['property', 'user']
const REASONS = [
  'fake_property',
  'wrong_information',
  'property_unavailable',
  'suspicious_payment_request',
  'fake_agent',
  'misleading_images',
  'duplicate_listing',
  'harassment',
  'other',
]
const STATUSES = ['pending', 'reviewed', 'actioned', 'dismissed']

const REPORT_JOIN = `
  id, target_type, target_id, reason, details, status, admin_notes,
  reviewed_by, reviewed_at, created_at,
  reporter:reporter_id(full_name)
`

function requireAdmin(req, res, next) {
  if (req.profile.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  next()
}

async function resolveTargetMeta(targetType, targetId) {
  if (targetType === 'property') {
    const { data } = await supabase
      .from('properties')
      .select('title, status')
      .eq('id', targetId)
      .maybeSingle()
    return { label: data?.title ?? null, propertyStatus: data?.status ?? null }
  }

  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', targetId)
    .maybeSingle()
  return { label: data?.full_name ?? null, propertyStatus: null }
}

function toReportCard(row, targetMeta) {
  return {
    id: row.id,
    target_type: row.target_type,
    target_id: row.target_id,
    target_label: targetMeta.label,
    target_property_status: targetMeta.propertyStatus,
    reason: row.reason,
    details: row.details,
    status: row.status,
    admin_notes: row.admin_notes,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    reporter_name: row.reporter?.full_name ?? null,
  }
}

router.use(requireAuth)

router.post('/', async (req, res) => {
  const { target_type: targetType, target_id: targetId, reason, details } =
    req.body || {}

  if (!TARGET_TYPES.includes(targetType)) {
    return res
      .status(400)
      .json({ error: 'target_type must be "property" or "user"' })
  }
  if (!targetId || !UUID_RE.test(targetId)) {
    return res.status(400).json({ error: 'A valid target_id is required' })
  }
  if (!REASONS.includes(reason)) {
    return res.status(400).json({ error: 'A valid reason is required' })
  }
  if (targetType === 'user' && targetId === req.profile.id) {
    return res.status(400).json({ error: "You can't report yourself" })
  }

  const table = targetType === 'property' ? 'properties' : 'profiles'
  const { data: target, error: targetError } = await supabase
    .from(table)
    .select('id')
    .eq('id', targetId)
    .maybeSingle()

  if (targetError) {
    return res.status(500).json({ error: 'Failed to look up report target' })
  }
  if (!target) {
    return res
      .status(404)
      .json({ error: `${targetType === 'property' ? 'Property' : 'User'} ${targetId} not found` })
  }

  const { data: existing, error: existingError } = await supabase
    .from('reports')
    .select(REPORT_JOIN)
    .eq('reporter_id', req.profile.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingError) {
    return res.status(500).json({ error: 'Failed to look up existing reports' })
  }

  if (existing) {
    const targetMeta = await resolveTargetMeta(targetType, targetId)
    return res.status(200).json(toReportCard(existing, targetMeta))
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: req.profile.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details ? String(details).trim() || null : null,
    })
    .select(REPORT_JOIN)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const targetMeta = await resolveTargetMeta(targetType, targetId)

  res.status(201).json(toReportCard(data, targetMeta))
})

router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' })
  }

  let query = supabase
    .from('reports')
    .select(REPORT_JOIN)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = await Promise.all(
    data.map(async (row) => {
      const targetMeta = await resolveTargetMeta(row.target_type, row.target_id)
      return toReportCard(row, targetMeta)
    }),
  )

  res.json({ items })
})

router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { status, admin_notes: adminNotes } = req.body || {}

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Report ${id} not found` })
  }
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'A valid status is required' })
  }

  const { data: previous } = await supabase
    .from('reports')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('reports')
    .update({
      status,
      admin_notes: adminNotes !== undefined ? adminNotes : undefined,
      reviewed_by: req.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(REPORT_JOIN)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  if (!data) {
    return res.status(404).json({ error: `Report ${id} not found` })
  }

  await logAdminAction(supabase, {
    adminId: req.profile.id,
    action: 'report.status_change',
    targetType: 'report',
    targetId: id,
    details: { old_status: previous?.status ?? null, new_status: status, admin_notes: adminNotes ?? null },
  })

  const targetMeta = await resolveTargetMeta(data.target_type, data.target_id)

  res.json(toReportCard(data, targetMeta))
})

export default router

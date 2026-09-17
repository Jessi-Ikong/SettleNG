import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'
import { logAdminAction } from '../lib/auditLog.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROLES = ['tenant', 'landlord', 'agent', 'admin']

function requireAdmin(req, res, next) {
  if (req.profile.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  next()
}

function parsePositiveInt(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.trunc(num) : null
}

async function countRows(table, applyFilters) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (applyFilters) query = applyFilters(query)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

router.use(requireAuth, requireAdmin)
router.use(generalApiLimiter)

router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      tenants,
      landlords,
      agents,
      totalProperties,
      phoneVerifiedUsers,
      identityVerifiedUsers,
      ownershipVerifiedProperties,
      pendingIdentityVerifications,
      pendingPropertyVerifications,
      pendingReports,
      completedInspections,
      activeListings,
      rentedProperties,
    ] = await Promise.all([
      countRows('profiles'),
      countRows('profiles', (q) => q.eq('role', 'tenant')),
      countRows('profiles', (q) => q.eq('role', 'landlord')),
      countRows('profiles', (q) => q.eq('role', 'agent')),
      countRows('properties'),
      countRows('profiles', (q) => q.eq('phone_verified', true)),
      countRows('profiles', (q) => q.eq('identity_verified', true)),
      countRows('properties', (q) => q.eq('ownership_verified', true)),
      countRows('identity_verifications', (q) => q.eq('status', 'pending')),
      countRows('property_verifications', (q) => q.eq('status', 'pending')),
      countRows('reports', (q) => q.eq('status', 'pending')),
      countRows('inspections', (q) => q.eq('status', 'completed')),
      countRows('properties', (q) => q.eq('status', 'available')),
      countRows('properties', (q) => q.eq('status', 'rented')),
    ])

    res.json({
      total_users: totalUsers,
      tenants,
      landlords,
      agents,
      total_properties: totalProperties,
      phone_verified_users: phoneVerifiedUsers,
      identity_verified_users: identityVerifiedUsers,
      ownership_verified_properties: ownershipVerifiedProperties,
      pending_identity_verifications: pendingIdentityVerifications,
      pending_property_verifications: pendingPropertyVerifications,
      pending_reports: pendingReports,
      completed_inspections: completedInspections,
      active_listings: activeListings,
      rented_properties: rentedProperties,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/users', async (req, res) => {
  const q = req.query
  const page = Math.max(1, parsePositiveInt(q.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(q.limit) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  if (q.role !== undefined && !ROLES.includes(q.role)) {
    return res.status(400).json({ error: 'Invalid role filter' })
  }

  let query = supabase
    .from('profiles')
    .select(
      'id, full_name, role, phone_verified, identity_verified, suspended, suspended_reason, is_super_admin, created_at',
    )
    .order('created_at', { ascending: false })

  if (q.role) {
    query = query.eq('role', q.role)
  }

  const { data, error } = await query

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Email lives only in auth.users, not profiles, so it can't be
  // filtered/paginated at the database level like full_name can — join
  // it in per row (same getUserById pattern as the verification queues),
  // then filter and paginate in memory so ?search= can match either
  // field.
  const withEmail = await Promise.all(
    data.map(async (row) => {
      const { data: authData } = await supabase.auth.admin.getUserById(row.id)
      return {
        id: row.id,
        full_name: row.full_name,
        email: authData?.user?.email ?? null,
        role: row.role,
        phone_verified: row.phone_verified,
        identity_verified: row.identity_verified,
        suspended: row.suspended,
        suspended_reason: row.suspended_reason,
        is_super_admin: row.is_super_admin,
        created_at: row.created_at,
      }
    }),
  )

  const search = q.search?.trim().toLowerCase()
  const filtered = search
    ? withEmail.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search),
      )
    : withEmail

  const total = filtered.length

  res.json({
    items: filtered.slice(from, to + 1),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  })
})

router.patch('/users/:id/suspend', async (req, res) => {
  const { id } = req.params
  const { reason } = req.body || {}

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `User ${id} not found` })
  }
  if (!reason?.trim()) {
    return res.status(400).json({ error: 'A reason is required to suspend' })
  }
  if (id === req.profile.id) {
    return res.status(400).json({ error: "You can't suspend your own account" })
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, suspended, role, is_super_admin')
    .eq('id', id)
    .maybeSingle()

  if (targetError) {
    return res.status(500).json({ error: 'Failed to look up user' })
  }
  if (!target) {
    return res.status(404).json({ error: `User ${id} not found` })
  }
  if (
    target.is_super_admin ||
    (target.role === 'admin' && req.profile.is_super_admin !== true)
  ) {
    return res
      .status(403)
      .json({ error: 'Only a super admin can act on another admin account' })
  }
  if (target.suspended) {
    return res.status(400).json({ error: 'This user is already suspended' })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      suspended: true,
      suspended_reason: reason.trim(),
      suspended_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, full_name, role, suspended, suspended_reason, suspended_at')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  await logAdminAction(supabase, {
    adminId: req.profile.id,
    action: 'user.suspend',
    targetType: 'user',
    targetId: id,
    details: { reason: reason.trim(), target_full_name: data.full_name },
  })

  res.json(data)
})

router.patch('/users/:id/unsuspend', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `User ${id} not found` })
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, role, is_super_admin')
    .eq('id', id)
    .maybeSingle()

  if (targetError) {
    return res.status(500).json({ error: 'Failed to look up user' })
  }
  if (!target) {
    return res.status(404).json({ error: `User ${id} not found` })
  }
  if (
    target.is_super_admin ||
    (target.role === 'admin' && req.profile.is_super_admin !== true)
  ) {
    return res
      .status(403)
      .json({ error: 'Only a super admin can act on another admin account' })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      suspended: false,
      suspended_reason: null,
      suspended_at: null,
    })
    .eq('id', id)
    .select('id, full_name, role, suspended, suspended_reason, suspended_at')
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  if (!data) {
    return res.status(404).json({ error: `User ${id} not found` })
  }

  await logAdminAction(supabase, {
    adminId: req.profile.id,
    action: 'user.unsuspend',
    targetType: 'user',
    targetId: id,
    details: { target_full_name: data.full_name },
  })

  res.json(data)
})

router.get('/audit-log', async (req, res) => {
  const q = req.query
  const page = Math.max(1, parsePositiveInt(q.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(q.limit) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('admin_audit_log')
    .select(
      'id, admin_id, action, target_type, target_id, details, created_at, admin:admin_id(full_name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (q.action) {
    query = query.eq('action', q.action)
  }
  if (q.admin_id) {
    if (!UUID_RE.test(q.admin_id)) {
      return res.status(400).json({ error: 'Invalid admin_id filter' })
    }
    query = query.eq('admin_id', q.admin_id)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({
    items: data.map((row) => ({
      id: row.id,
      admin_id: row.admin_id,
      admin_name: row.admin?.full_name ?? null,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      details: row.details,
      created_at: row.created_at,
    })),
    page,
    pageSize,
    total: count,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
})

router.patch('/states/:id', async (req, res) => {
  const { id } = req.params
  const { active } = req.body || {}

  if (!/^\d+$/.test(id)) {
    return res.status(404).json({ error: `State ${id} not found` })
  }
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' })
  }

  const { data, error } = await supabase
    .from('states')
    .update({ active })
    .eq('id', id)
    .select('id, name, active')
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  if (!data) {
    return res.status(404).json({ error: `State ${id} not found` })
  }

  await logAdminAction(supabase, {
    adminId: req.profile.id,
    action: active ? 'state.activate' : 'state.deactivate',
    targetType: 'state',
    targetId: id,
    details: { state_name: data.name },
  })

  res.json(data)
})

export default router

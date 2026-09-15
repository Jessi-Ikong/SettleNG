import { randomUUID } from 'crypto'
import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { logAdminAction } from '../lib/auditLog.js'
import { verificationDocumentUpload, withUploadErrorHandling } from '../lib/uploads.js'
import { createAuthLimiter } from '../middleware/rateLimiters.js'

const phoneRequestLimiter = createAuthLimiter()
const phoneConfirmLimiter = createAuthLimiter()

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const OTP_TTL_MS = 10 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const SIGNED_URL_TTL_SECONDS = 300

function requireAdmin(req, res, next) {
  if (req.profile.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  next()
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

router.use(requireAuth)

router.post('/phone/request', phoneRequestLimiter, async (req, res) => {
  const { error: invalidateError } = await supabase
    .from('phone_otps')
    .delete()
    .eq('user_id', req.profile.id)
    .is('verified_at', null)

  if (invalidateError) {
    return res.status(500).json({ error: 'Failed to invalidate previous codes' })
  }

  const code = generateOtpCode()

  const { data, error } = await supabase
    .from('phone_otps')
    .insert({
      user_id: req.profile.id,
      code,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // dev_code is a stand-in for the real SMS provider we don't have
  // yet — it lets the frontend show the code directly instead of
  // texting it. Once a real provider is wired in, this response
  // should drop to just { message }; the frontend's "SMS isn't
  // connected yet" note keys off dev_code being present, so removing
  // this one field is the only backend change needed then.
  res.json({
    message: 'Verification code generated',
    dev_code: code,
  })
})

router.post('/phone/confirm', phoneConfirmLimiter, async (req, res) => {
  const { code } = req.body || {}

  if (!code) {
    return res.status(400).json({ error: 'A code is required' })
  }

  const { data: otp, error: otpError } = await supabase
    .from('phone_otps')
    .select('id, code, expires_at, attempts')
    .eq('user_id', req.profile.id)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (otpError) {
    return res.status(500).json({ error: 'Failed to look up verification code' })
  }
  if (!otp) {
    return res
      .status(400)
      .json({ error: 'No active verification code — please request a new one' })
  }

  if (String(code).trim() !== otp.code) {
    const attempts = otp.attempts + 1

    if (attempts >= MAX_OTP_ATTEMPTS) {
      await supabase.from('phone_otps').delete().eq('id', otp.id)
      return res.status(400).json({
        error: 'Too many incorrect attempts — please request a new code',
      })
    }

    const { error: attemptsError } = await supabase
      .from('phone_otps')
      .update({ attempts })
      .eq('id', otp.id)

    if (attemptsError) {
      return res.status(500).json({ error: attemptsError.message })
    }

    return res.status(400).json({
      error: `Incorrect code — ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining`,
    })
  }

  const { error: verifyError } = await supabase
    .from('phone_otps')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', otp.id)

  if (verifyError) {
    return res.status(500).json({ error: verifyError.message })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ phone_verified: true })
    .eq('id', req.profile.id)

  if (profileError) {
    return res.status(500).json({ error: profileError.message })
  }

  res.json({ message: 'Phone verified' })
})

router.post(
  '/identity',
  withUploadErrorHandling(verificationDocumentUpload.single('document')),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'A document file is required' })
    }

    const { data: existingPending, error: existingError } = await supabase
      .from('identity_verifications')
      .select('id')
      .eq('user_id', req.profile.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingError) {
      return res
        .status(500)
        .json({ error: 'Failed to look up existing submissions' })
    }
    if (existingPending) {
      return res.status(400).json({
        error: 'You already have a submission under review',
      })
    }

    const path = `${req.profile.id}/${randomUUID()}-${req.file.originalname}`

    const { error: uploadError } = await supabase.storage
      .from('verification-documents')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype })

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message })
    }

    // document_url stores the private bucket's internal storage path,
    // never a public URL — the bucket isn't public, so any viewing
    // (admin queue, this response) goes through a freshly generated
    // signed URL instead.
    const { data, error } = await supabase
      .from('identity_verifications')
      .insert({
        user_id: req.profile.id,
        document_url: path,
        status: 'pending',
      })
      .select('id, status, created_at')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json(data)
  },
)

router.get('/identity/status', async (req, res) => {
  const { data, error } = await supabase
    .from('identity_verifications')
    .select('id, status, admin_notes, created_at')
    .eq('user_id', req.profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data || null)
})

router.get('/identity/queue', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('identity_verifications')
    .select('id, user_id, document_url, created_at, submitter:user_id(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = await Promise.all(
    data.map(async (row) => {
      const [{ data: authData }, { data: signedUrlData }] = await Promise.all([
        supabase.auth.admin.getUserById(row.user_id),
        supabase.storage
          .from('verification-documents')
          .createSignedUrl(row.document_url, SIGNED_URL_TTL_SECONDS),
      ])

      return {
        id: row.id,
        user_id: row.user_id,
        submitter_name: row.submitter?.full_name ?? null,
        submitter_email: authData?.user?.email ?? null,
        document_signed_url: signedUrlData?.signedUrl ?? null,
        created_at: row.created_at,
      }
    }),
  )

  res.json({ items })
})

router.patch('/identity/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { status, admin_notes: adminNotes } = req.body || {}

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Submission ${id} not found` })
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res
      .status(400)
      .json({ error: 'status must be "approved" or "rejected"' })
  }
  if (status === 'rejected' && !adminNotes?.trim()) {
    return res
      .status(400)
      .json({ error: 'admin_notes is required when rejecting' })
  }

  const { data, error } = await supabase
    .from('identity_verifications')
    .update({
      status,
      admin_notes: adminNotes ? String(adminNotes).trim() : null,
      reviewed_by: req.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, user_id, status, admin_notes, reviewed_by, reviewed_at, created_at')
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  if (!data) {
    return res.status(404).json({ error: `Submission ${id} not found` })
  }

  if (status === 'approved') {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ identity_verified: true })
      .eq('id', data.user_id)

    if (profileError) {
      return res.status(500).json({ error: profileError.message })
    }
  }

  await logAdminAction(supabase, {
    adminId: req.profile.id,
    action: status === 'approved' ? 'identity_verification.approve' : 'identity_verification.reject',
    targetType: 'identity_verification',
    targetId: id,
    details: { user_id: data.user_id, admin_notes: data.admin_notes },
  })

  res.json(data)
})

router.post(
  '/property/:propertyId',
  withUploadErrorHandling(verificationDocumentUpload.single('document')),
  async (req, res) => {
    const { propertyId } = req.params

    if (!UUID_RE.test(propertyId)) {
      return res.status(404).json({ error: `Property ${propertyId} not found` })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'A document file is required' })
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, owner_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyError) {
      return res.status(500).json({ error: 'Failed to look up property' })
    }
    if (!property) {
      return res.status(404).json({ error: `Property ${propertyId} not found` })
    }
    if (property.owner_id !== req.profile.id) {
      return res.status(403).json({ error: 'You do not own this property' })
    }

    const { data: existingPending, error: existingError } = await supabase
      .from('property_verifications')
      .select('id')
      .eq('property_id', propertyId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingError) {
      return res
        .status(500)
        .json({ error: 'Failed to look up existing submissions' })
    }
    if (existingPending) {
      return res.status(400).json({
        error: 'This property already has a submission under review',
      })
    }

    // Namespaced under "property/" so these never collide with identity
    // documents (which live under "<user id>/...") in the same shared
    // private bucket.
    const path = `property/${propertyId}/${randomUUID()}-${req.file.originalname}`

    const { error: uploadError } = await supabase.storage
      .from('verification-documents')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype })

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message })
    }

    const { data, error } = await supabase
      .from('property_verifications')
      .insert({
        property_id: propertyId,
        submitted_by: req.profile.id,
        document_url: path,
        status: 'pending',
      })
      .select('id, status, created_at')
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    res.status(201).json(data)
  },
)

router.get('/property/queue', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('property_verifications')
    .select(
      `
      id, property_id, document_url, created_at,
      property:property_id(
        title,
        owner:owner_id(full_name),
        property_images(url, sort_order)
      )
    `,
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const items = await Promise.all(
    data.map(async (row) => {
      const { data: signedUrlData } = await supabase.storage
        .from('verification-documents')
        .createSignedUrl(row.document_url, SIGNED_URL_TTL_SECONDS)

      const images = [...(row.property?.property_images || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )

      return {
        id: row.id,
        property_id: row.property_id,
        property_title: row.property?.title ?? null,
        property_first_image: images[0]?.url ?? null,
        owner_name: row.property?.owner?.full_name ?? null,
        document_signed_url: signedUrlData?.signedUrl ?? null,
        created_at: row.created_at,
      }
    }),
  )

  res.json({ items })
})

router.get('/property/:propertyId/status', async (req, res) => {
  const { propertyId } = req.params

  if (!UUID_RE.test(propertyId)) {
    return res.status(404).json({ error: `Property ${propertyId} not found` })
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (propertyError) {
    return res.status(500).json({ error: 'Failed to look up property' })
  }
  if (!property) {
    return res.status(404).json({ error: `Property ${propertyId} not found` })
  }
  if (property.owner_id !== req.profile.id) {
    return res.status(403).json({ error: 'You do not own this property' })
  }

  const { data, error } = await supabase
    .from('property_verifications')
    .select('id, status, admin_notes, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data || null)
})

router.patch('/property/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { status, admin_notes: adminNotes } = req.body || {}

  if (!UUID_RE.test(id)) {
    return res.status(404).json({ error: `Submission ${id} not found` })
  }
  if (!['approved', 'rejected'].includes(status)) {
    return res
      .status(400)
      .json({ error: 'status must be "approved" or "rejected"' })
  }
  if (status === 'rejected' && !adminNotes?.trim()) {
    return res
      .status(400)
      .json({ error: 'admin_notes is required when rejecting' })
  }

  const { data, error } = await supabase
    .from('property_verifications')
    .update({
      status,
      admin_notes: adminNotes ? String(adminNotes).trim() : null,
      reviewed_by: req.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, property_id, status, admin_notes, reviewed_by, reviewed_at, created_at')
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  if (!data) {
    return res.status(404).json({ error: `Submission ${id} not found` })
  }

  if (status === 'approved') {
    const { error: propertyError } = await supabase
      .from('properties')
      .update({ ownership_verified: true })
      .eq('id', data.property_id)

    if (propertyError) {
      return res.status(500).json({ error: propertyError.message })
    }
  }

  await logAdminAction(supabase, {
    adminId: req.profile.id,
    action: status === 'approved' ? 'property_verification.approve' : 'property_verification.reject',
    targetType: 'property_verification',
    targetId: id,
    details: { property_id: data.property_id, admin_notes: data.admin_notes },
  })

  res.json(data)
})

export default router

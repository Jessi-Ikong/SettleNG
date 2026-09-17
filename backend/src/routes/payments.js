import crypto from 'crypto'
import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import { requireAuth } from '../middleware/auth.js'
import { generalApiLimiter } from '../middleware/rateLimiters.js'
import { hasEligibleInspection } from '../lib/eligibility.js'
import { PRICING_FIELDS, LOCATION_JOIN, computeMoveInCost } from '../lib/propertyShape.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

// Same "production origins get added to ALLOWED_ORIGINS, first entry
// is the primary one" convention used for CORS in index.js and for
// share.js's canonical URLs — reused here for Paystack's callback_url
// rather than introducing a second env var for the same thing.
const FRONTEND_ORIGIN = process.env.ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)[0]

const PAYMENT_PROPERTY_JOIN = `
  title, unit_label, street, building_id,
  building:building_id(name),
  property_images(url, sort_order),
  ${LOCATION_JOIN}
`

const PAYMENT_JOIN_FOR_TENANT = `
  id, property_id, amount, paystack_reference, status, paid_at, created_at,
  property:property_id(${PAYMENT_PROPERTY_JOIN}),
  landlord:landlord_id(full_name)
`

const PAYMENT_JOIN_FOR_LANDLORD = `
  id, property_id, tenant_id, amount, paystack_reference, status, paid_at, created_at,
  property:property_id(${PAYMENT_PROPERTY_JOIN}),
  tenant:tenant_id(full_name)
`

function toPaymentPropertyFields(property) {
  const images = [...(property?.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  return {
    property_title: property?.title ?? null,
    property_unit_label: property?.unit_label ?? null,
    property_building_id: property?.building_id ?? null,
    property_building_name: property?.building?.name ?? null,
    property_first_image: images[0]?.url ?? null,
    property_street: property?.street ?? null,
    property_neighborhood: property?.neighborhood ?? null,
    property_ward: property?.ward ?? null,
  }
}

function toTenantPaymentCard(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    ...toPaymentPropertyFields(row.property),
    landlord_name: row.landlord?.full_name ?? null,
    amount: row.amount,
    paystack_reference: row.paystack_reference,
    status: row.status,
    paid_at: row.paid_at,
    created_at: row.created_at,
  }
}

function toLandlordPaymentCard(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    ...toPaymentPropertyFields(row.property),
    tenant_id: row.tenant_id,
    tenant_name: row.tenant?.full_name ?? null,
    amount: row.amount,
    paystack_reference: row.paystack_reference,
    status: row.status,
    paid_at: row.paid_at,
    created_at: row.created_at,
  }
}

// Paystack's own transaction status values are 'success', 'failed', or
// 'abandoned' — chosen to match this table's payment_status enum
// exactly (plus our own 'initialized' default), so a verified
// Paystack status can be written to the status column as-is.
const PAYSTACK_TO_LOCAL_STATUS = new Set(['success', 'failed', 'abandoned'])

router.post('/initialize', requireAuth, generalApiLimiter, async (req, res) => {
  const { property_id: propertyId } = req.body || {}

  if (!propertyId || !UUID_RE.test(propertyId)) {
    return res.status(400).json({ error: 'A valid property_id is required' })
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select(`id, owner_id, title, ${PRICING_FIELDS.join(', ')}`)
    .eq('id', propertyId)
    .maybeSingle()

  if (propertyError) {
    return res.status(500).json({ error: 'Failed to look up property' })
  }
  if (!property) {
    return res.status(404).json({ error: `Property ${propertyId} not found` })
  }
  if (property.owner_id === req.profile.id) {
    return res
      .status(400)
      .json({ error: 'You cannot pay for your own property' })
  }

  let eligible
  try {
    eligible = await hasEligibleInspection(propertyId, req.profile.id)
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'Failed to verify tenant eligibility' })
  }
  if (!eligible) {
    return res.status(400).json({
      error:
        'You need a completed or accepted inspection on this property before paying',
    })
  }

  // Only a genuine prior success blocks a retry — a failed or
  // abandoned attempt (declined card, checkout closed, etc.) must
  // not lock the tenant out of trying again.
  const { data: existingSuccess, error: existingSuccessError } = await supabase
    .from('payments')
    .select('id')
    .eq('property_id', propertyId)
    .eq('tenant_id', req.profile.id)
    .eq('status', 'success')
    .limit(1)
    .maybeSingle()

  if (existingSuccessError) {
    return res
      .status(500)
      .json({ error: 'Failed to check existing payments' })
  }
  if (existingSuccess) {
    return res
      .status(400)
      .json({ error: 'You have already paid for this property' })
  }

  const { total: amount } = computeMoveInCost(property)
  if (amount == null) {
    return res.status(400).json({
      error: 'This property has no move-in cost breakdown to pay yet',
    })
  }

  let paystackData
  try {
    const paystackRes = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: req.user.email,
          amount: Math.round(amount * 100),
          callback_url: `${FRONTEND_ORIGIN}/payments/callback`,
          metadata: { property_id: propertyId, tenant_id: req.profile.id },
        }),
      },
    )
    paystackData = await paystackRes.json()
    if (!paystackRes.ok || !paystackData.status) {
      throw new Error(paystackData.message || 'Paystack initialization failed')
    }
  } catch (err) {
    console.error('Paystack initialize error:', err)
    return res
      .status(502)
      .json({ error: 'Failed to start payment with Paystack' })
  }

  const { authorization_url: authorizationUrl, reference } =
    paystackData.data

  const { error: insertError } = await supabase.from('payments').insert({
    property_id: propertyId,
    tenant_id: req.profile.id,
    landlord_id: property.owner_id,
    amount,
    paystack_reference: reference,
    status: 'initialized',
  })

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  res.json({ authorization_url: authorizationUrl })
})

// Public: Paystack calls this directly, no user auth token involved.
// Authenticity instead comes entirely from the HMAC signature check
// below, over the raw request body index.js's express.json(verify:)
// captured as req.rawBody.
router.post('/webhook', generalApiLimiter, async (req, res) => {
  const signature = req.headers['x-paystack-signature']
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody || Buffer.alloc(0))
    .digest('hex')

  const signatureBuffer = Buffer.from(signature || '', 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

  if (!signatureValid) {
    console.error('Rejected Paystack webhook: signature mismatch')
    return res.sendStatus(401)
  }

  const event = req.body || {}
  const eventType = event.event
  const reference = event.data?.reference

  if (eventType !== 'charge.success' && eventType !== 'charge.failed') {
    console.log(`Ignoring unhandled Paystack webhook event: ${eventType}`)
    return res.sendStatus(200)
  }

  if (!reference) {
    console.error(`Paystack webhook ${eventType} arrived with no reference`)
    return res.sendStatus(200)
  }

  const { data: existingEvent, error: existingError } = await supabase
    .from('payment_events')
    .select('id')
    .eq('paystack_reference', reference)
    .eq('event_type', eventType)
    .eq('processed', true)
    .maybeSingle()

  if (existingError) {
    return res.status(500).json({ error: existingError.message })
  }
  // Idempotency: Paystack may send the same webhook more than once.
  if (existingEvent) {
    return res.sendStatus(200)
  }

  const { data: insertedEvent, error: insertError } = await supabase
    .from('payment_events')
    .insert({
      paystack_reference: reference,
      event_type: eventType,
      raw_payload: event,
      processed: false,
    })
    .select('id')
    .single()

  if (insertError) {
    return res.status(500).json({ error: insertError.message })
  }

  const newStatus = eventType === 'charge.success' ? 'success' : 'failed'
  const updatePayload = { status: newStatus }
  if (newStatus === 'success') updatePayload.paid_at = new Date().toISOString()

  // 'success' is terminal — a stray charge.failed for an already-paid
  // reference (Paystack shouldn't send both for the same transaction,
  // but this is cheap insurance) must not downgrade it.
  const { error: updateError } = await supabase
    .from('payments')
    .update(updatePayload)
    .eq('paystack_reference', reference)
    .neq('status', 'success')

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  const { error: processedError } = await supabase
    .from('payment_events')
    .update({ processed: true })
    .eq('id', insertedEvent.id)

  if (processedError) {
    return res.status(500).json({ error: processedError.message })
  }

  res.sendStatus(200)
})

router.get('/verify/:reference', requireAuth, generalApiLimiter, async (req, res) => {
  const { reference } = req.params

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select(
      'id, property_id, tenant_id, amount, paystack_reference, status, paid_at, created_at, property:property_id(title)',
    )
    .eq('paystack_reference', reference)
    .maybeSingle()

  if (paymentError) {
    return res.status(500).json({ error: paymentError.message })
  }
  if (!payment) {
    return res.status(404).json({ error: `Payment ${reference} not found` })
  }
  if (payment.tenant_id !== req.profile.id) {
    return res
      .status(403)
      .json({ error: 'You do not have access to this payment' })
  }

  let status = payment.status
  let paidAt = payment.paid_at

  try {
    const verifyRes = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    )
    const verifyData = await verifyRes.json()

    if (verifyRes.ok && verifyData.status) {
      const paystackStatus = verifyData.data?.status
      // Webhook delivery can lag behind the user landing on the
      // callback page — this is an immediate check the frontend can
      // call right after redirect-back. Both paths are idempotent by
      // reference, so writing here as well as from the webhook is safe.
      // 'success' is treated as terminal and never overwritten: once
      // paid_at is set from a genuine charge.success, a later verify
      // call reporting a different status (e.g. Paystack settling the
      // transaction record as 'abandoned' after the fact) must not
      // regress a completed payment.
      if (
        PAYSTACK_TO_LOCAL_STATUS.has(paystackStatus) &&
        paystackStatus !== payment.status &&
        payment.status !== 'success'
      ) {
        const updatePayload = { status: paystackStatus }
        if (paystackStatus === 'success') {
          updatePayload.paid_at = new Date().toISOString()
        }

        const { data: updated, error: updateError } = await supabase
          .from('payments')
          .update(updatePayload)
          .eq('paystack_reference', reference)
          .select('status, paid_at')
          .single()

        if (updateError) {
          return res.status(500).json({ error: updateError.message })
        }

        status = updated.status
        paidAt = updated.paid_at
      }
    }
  } catch (err) {
    console.error('Paystack verify error:', err)
    // Fall through and return the local status we already have rather
    // than failing the whole request over a transient Paystack outage.
  }

  res.json({
    reference: payment.paystack_reference,
    status,
    amount: payment.amount,
    paid_at: paidAt,
    created_at: payment.created_at,
    property: { id: payment.property_id, title: payment.property?.title ?? null },
  })
})

router.get('/mine', requireAuth, generalApiLimiter, async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_JOIN_FOR_TENANT)
    .eq('tenant_id', req.profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ items: data.map(toTenantPaymentCard) })
})

router.get('/received', requireAuth, generalApiLimiter, async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_JOIN_FOR_LANDLORD)
    .eq('landlord_id', req.profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ items: data.map(toLandlordPaymentCard) })
})

export default router

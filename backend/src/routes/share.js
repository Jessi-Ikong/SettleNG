import { Router } from 'express'
import { supabase } from '../lib/supabaseClient.js'
import {
  LOCATION_JOIN,
  PRICING_FIELDS,
  computeMoveInCost,
} from '../lib/propertyShape.js'

const router = Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Same "production origins get added to ALLOWED_ORIGINS, first entry
// is the primary one" convention used for CORS in index.js — reused
// here rather than introducing a second env var for the same thing.
const FRONTEND_ORIGIN = process.env.ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)[0]

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  )
}

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

function locationLabel(property) {
  const parts = [
    property.neighborhood?.name,
    property.ward?.name,
    property.ward?.lga?.name,
    property.ward?.lga?.state?.name,
  ].filter(Boolean)
  return parts.join(', ')
}

// Serves a plain, server-rendered HTML shell with real Open Graph tags
// for a single property, so link-preview crawlers (WhatsApp, Facebook,
// Twitter, Slack) — which fetch raw HTML and never execute JavaScript
// — see the actual property's title/description/image instead of
// nothing. This can't be done client-side in a Vite SPA: any tag set
// via React only exists in the DOM after JS runs, which crawlers never
// do. Returns a real 200 (not a redirect) because crawlers don't
// reliably follow redirects before scraping OG tags; a meta-refresh
// plus a JS redirect below send actual human visitors on to the real
// SPA property page.
router.get('/properties/:id', async (req, res) => {
  const { id } = req.params

  if (!UUID_RE.test(id)) {
    return res.status(404).type('html').send('<h1>Property not found</h1>')
  }

  const { data: property, error } = await supabase
    .from('properties')
    .select(
      `id, title, bedrooms, bathrooms, status, ${LOCATION_JOIN}, ${PRICING_FIELDS.join(', ')}, property_images(url, sort_order)`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !property || property.status !== 'available') {
    return res.status(404).type('html').send('<h1>Property not found</h1>')
  }

  const images = [...(property.property_images || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )
  const image = images[0]?.url

  const moveIn = computeMoveInCost(property)
  const priceText =
    property.rent_amount != null
      ? `${formatNaira(property.rent_amount)}/year rent`
      : moveIn.total
        ? `from ${formatNaira(moveIn.total)} move-in cost`
        : 'Price on request'

  const bedroomsText =
    property.bedrooms != null
      ? `${property.bedrooms} bed${property.bedrooms === 1 ? '' : 's'}`
      : null

  const description = [bedroomsText, locationLabel(property), priceText]
    .filter(Boolean)
    .join(' • ')

  const title = property.title || 'A property on SettleNG'
  const canonicalUrl = `${FRONTEND_ORIGIN}/properties/${property.id}`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)} — SettleNG</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
    <script>window.location.replace(${JSON.stringify(canonicalUrl)});</script>
  </head>
  <body>
    <p>
      Redirecting to
      <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title)} on SettleNG</a>...
    </p>
  </body>
</html>`

  res.status(200).type('html').send(html)
})

export default router

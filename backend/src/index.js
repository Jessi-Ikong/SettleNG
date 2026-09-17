import 'dotenv/config'
// Side-effect import, deliberately first (right after dotenv/config
// populates process.env): validates required env vars and exits
// immediately if any are missing. Must come before every other
// import below — ES modules evaluate all imports, in order, before
// any of this file's own top-level code runs, so a validateEnv()
// *call* placed here instead would run too late, after
// routes/*.js's transitive lib/supabaseClient.js had already crashed
// with Supabase's own confusing raw error.
import './lib/env.js'
import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/errorHandler.js'
import meRouter from './routes/me.js'
import locationsRouter from './routes/locations.js'
import propertiesRouter from './routes/properties.js'
import favoritesRouter from './routes/favorites.js'
import savedSearchesRouter from './routes/savedSearches.js'
import inspectionsRouter from './routes/inspections.js'
import conversationsRouter from './routes/conversations.js'
import messagesRouter from './routes/messages.js'
import reportsRouter from './routes/reports.js'
import reviewsRouter from './routes/reviews.js'
import verificationRouter from './routes/verification.js'
import adminRouter from './routes/admin.js'
import tenanciesRouter from './routes/tenancies.js'
import buildingsRouter from './routes/buildings.js'
import shareRouter from './routes/share.js'
import paymentsRouter from './routes/payments.js'

const app = express()
const PORT = process.env.PORT

// Production origins get added to ALLOWED_ORIGINS (comma-separated)
// once a real domain exists — see README.md. For now this is just
// the local Vite dev server.
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header at all (curl, server-to-server calls, the
      // health check) isn't a browser cross-origin request, so it's
      // not something CORS applies to — let it through and leave any
      // access control for that case to auth/route logic instead.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
  }),
)
// Gives a CORS rejection its own clean 403 instead of falling through
// to the generic catch-all error handler as an unexplained 500.
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  next(err)
})

// Captures the raw request body alongside Express's normal JSON
// parsing (rather than a separate raw-body route) so every other
// route keeps using req.body as-is; only the Paystack webhook route
// reads req.rawBody, needed there because HMAC signature verification
// must run over the exact bytes Paystack sent, not a re-serialized
// (and potentially differently-ordered/whitespaced) copy of the
// parsed JSON.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf
    },
  }),
)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SettleNG API' })
})

// Server-rendered HTML shells for link-preview crawlers — deliberately
// outside /api and the rate limiter below, since a crawler fetch isn't
// a client API call and shouldn't compete with one for the same quota.
app.use('/share', shareRouter)

// No longer a single global mount here — each router below applies
// the general rate limiter itself, positioned after that router's own
// requireAuth where it has one, so the limiter can key by the
// authenticated user's id instead of shared IP. See
// middleware/rateLimiters.js for why. /api/health stays unlimited
// (uptime/monitoring pings shouldn't compete with real traffic for a
// budget), same as before.

app.use('/api/me', meRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/properties', propertiesRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/saved-searches', savedSearchesRouter)
app.use('/api/inspections', inspectionsRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/reviews', reviewsRouter)
app.use('/api/verification', verificationRouter)
app.use('/api/admin', adminRouter)
app.use('/api/tenancies', tenanciesRouter)
app.use('/api/buildings', buildingsRouter)
app.use('/api/payments', paymentsRouter)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`SettleNG API listening on port ${PORT}`)
})

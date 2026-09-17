import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

// standardHeaders adds RateLimit-* headers (including a Retry-After
// once the limit is hit), so a rejected client gets an actual hint
// instead of a silent, unexplained block.
const RATE_LIMIT_OPTIONS = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
}

// Keys the limiter by the authenticated user's id whenever requireAuth
// has already run earlier in the same request's middleware chain
// (every limiter below is deliberately mounted AFTER requireAuth on
// any route that has it, specifically so req.profile is populated by
// the time this runs) — not by IP. IP-based limiting means every
// tenant behind the same carrier-grade NAT or office network shares
// one budget, so a handful of active users can lock everyone else on
// that IP out; keying by user id gives each account its own
// independent budget regardless of who else shares its network. Only
// falls back to req.ip for genuinely pre-authentication requests where
// no req.profile exists yet (there's no user id to key by) — using
// express-rate-limit's own ipKeyGenerator so IPv6 addresses are
// normalized correctly instead of letting address variation bypass
// the limit.
function userOrIpKey(req) {
  return req.profile?.id || ipKeyGenerator(req.ip)
}

// Auth-adjacent endpoints that sit outside Supabase Auth itself (the
// phone OTP request/confirm pair) get a strict limiter — these are
// exactly the kind of endpoint brute-forcing targets. A factory, not
// a shared instance: each call returns its own independent counter,
// so exhausting the "request a code" budget doesn't also exhaust the
// unrelated "confirm a code" budget for the same user — sharing one
// counter across both would leave someone who requests a code, then
// mistypes it once or twice, with no attempts left to actually
// confirm it. Both call sites (verification.js) mount this after
// requireAuth, so it's keyed by user id like everything else here.
export function createAuthLimiter() {
  return rateLimit({
    ...RATE_LIMIT_OPTIONS,
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: userOrIpKey,
  })
}

// Everything else under /api gets a more generous general limiter.
// Mounted per-router/per-route (after requireAuth where the route has
// it) rather than once globally, specifically so this keyGenerator
// actually has req.profile available when a route is authenticated —
// a single global app.use('/api', ...) mount would run before any
// route's own requireAuth and could never see it.
export const generalApiLimiter = rateLimit({
  ...RATE_LIMIT_OPTIONS,
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: userOrIpKey,
})

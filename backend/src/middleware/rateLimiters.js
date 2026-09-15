import rateLimit from 'express-rate-limit'

// standardHeaders adds RateLimit-* headers (including a Retry-After
// once the limit is hit), so a rejected client gets an actual hint
// instead of a silent, unexplained block.
const RATE_LIMIT_OPTIONS = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
}

// Auth-adjacent endpoints that sit outside Supabase Auth itself (the
// phone OTP request/confirm pair) get a strict limiter — these are
// exactly the kind of endpoint brute-forcing targets. A factory, not
// a shared instance: each call returns its own independent counter,
// so exhausting the "request a code" budget doesn't also exhaust the
// unrelated "confirm a code" budget for the same user — sharing one
// counter across both would leave someone who requests a code, then
// mistypes it once or twice, with no attempts left to actually
// confirm it.
export function createAuthLimiter() {
  return rateLimit({
    ...RATE_LIMIT_OPTIONS,
    windowMs: 15 * 60 * 1000,
    max: 5,
  })
}

// Everything else under /api gets a more generous general limiter.
export const generalApiLimiter = rateLimit({
  ...RATE_LIMIT_OPTIONS,
  windowMs: 15 * 60 * 1000,
  max: 100,
})

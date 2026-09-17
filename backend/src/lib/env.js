const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'PORT',
  'ALLOWED_ORIGINS',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_PUBLIC_KEY',
]

// Runs as a side effect of importing this module, not as a function
// the caller has to remember to invoke — and crucially, this module
// must be the very first thing index.js imports (right after
// 'dotenv/config'). ES module imports are all evaluated, in the order
// written, before any of the importing file's own top-level code runs
// — so a validateEnv() *call* placed after the route imports in
// index.js would run too late: routes/properties.js (and everything
// else) transitively creates a Supabase client at import time via
// lib/supabaseClient.js, which would already have crashed with
// Supabase's own raw, confusing error before this ever got a chance
// to run. Self-invoking here, imported first, is what actually
// guarantees this check happens before anything else touches
// process.env.
const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name])

if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Check backend/.env against backend/.env.example.',
  )
  process.exit(1)
}

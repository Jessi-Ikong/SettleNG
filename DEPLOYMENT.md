# Deploying SettleNG

This documents how to deploy SettleNG for real, once the product owner
has hosting accounts on **Render** (backend) and **Vercel** (frontend).
This document does not deploy anything itself — it's the checklist to
follow when the product owner is ready to go live.

The backend and frontend each need the other's real URL before their
own env vars can be finalized, so **order matters**. Follow the steps
in order — don't jump ahead.

## Step 1 — Deploy the backend first

Deploy `backend/` to Render as a Web Service.

- **Build command**: `npm install`
- **Start command**: `npm start` (runs `node src/index.js`)

Set these environment variables in Render's dashboard (from
`backend/.env.example`):

| Variable | Description |
|---|---|
| `PORT` | **Don't set this manually.** Render injects its own `PORT` at runtime, and `backend/src/index.js` already reads `process.env.PORT` directly with no hardcoded fallback — it will bind to whatever port Render assigns. Only needed as a real value in your local `.env` file for `npm run dev`/`npm start` on your own machine. |
| `SUPABASE_URL` | Your Supabase project's URL (same project as local dev, or a separate production project — product owner's call). |
| `SUPABASE_SERVICE_KEY` | Supabase service-role key for that project. Grants full database access server-side — never expose this to the frontend. |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the API via CORS. **Leave this as a placeholder for now** (e.g. keep it pointing at `http://localhost:5173`, or set it to the Render service's own URL as a harmless placeholder) — the real frontend URL doesn't exist yet at this step. You'll come back and update this in Step 3. |
| `PAYSTACK_SECRET_KEY` | Paystack secret key — used server-side to initialize payments and verify webhook signatures. |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key — returned to the frontend to render Paystack's payment popup. |

Once deployed, note the real backend URL Render gives you (something
like `https://settleng-api.onrender.com`). You'll need it in Step 2.

## Step 2 — Deploy the frontend

Deploy `frontend/` to Vercel.

- **Build command**: `npm install && npm run build` (this also runs
  the `postbuild` step automatically — see the note on
  `VITE_SITE_URL` below)
- **Output directory**: `dist`

Set these environment variables in Vercel's dashboard (from
`frontend/.env.example`):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Same Supabase project URL used by the backend. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key — safe to expose client-side, Row Level Security enforces access control. |
| `VITE_API_URL` | **Set this to the real backend URL from Step 1** (e.g. `https://settleng-api.onrender.com`), no trailing slash. Every frontend API call reads this via `frontend/src/lib/api.js`, which falls back to `http://localhost:5050` only when this var is unset — that fallback is dev-only and never reachable in a real Vercel build. |
| `VITE_SITE_URL` | The frontend's own real deployed URL (e.g. `https://settleng.vercel.app`), no trailing slash. Used only by the `postbuild` script (`frontend/scripts/generate-seo-files.js`) to rewrite the checked-in `http://localhost:5173` placeholder URLs in the built `dist/sitemap.xml` and `dist/robots.txt` — see the audit note below for why this exists. |

Once deployed, note the real frontend URL Vercel gives you (or your
custom domain, once attached).

## Step 3 — Go back and finish the backend's CORS config

Now that the frontend's real URL exists:

1. In Render, update the backend's `ALLOWED_ORIGINS` to include the
   real frontend URL from Step 2 (comma-separated if there's more than
   one, e.g. a Vercel preview URL plus a production custom domain).
2. Redeploy the backend so the new `ALLOWED_ORIGINS` takes effect.

Until this step is done, the deployed frontend's requests to the
deployed backend will be rejected by CORS with a 403 — this is
expected and part of the normal deploy order, not a bug.

## Step 4 — Point Paystack's webhook at the real backend

In the Paystack dashboard, update the webhook URL to:

```
https://<your-real-backend-domain>/api/payments/webhook
```

This is the moment this becomes actionable — local dev can never
receive real inbound Paystack webhooks (Paystack calls whatever URL is
configured in its dashboard, never `localhost`), which is why
`GET /api/payments/verify/:reference` exists and is called from the
frontend's payment-callback page regardless of webhook delivery. That
verify-on-callback path keeps working in production too, but the
webhook still needs a real URL registered so Paystack's own retried/
delayed delivery and idempotency both work as designed. (Already noted
in `test.txt` from the payments phase — restated here since this is
the step where it actually needs to be done.)

## Hardcoded-localhost audit (frontend/backend source)

A full-repo grep for `localhost` and `127.0.0.1` (excluding
`node_modules`) found:

- `frontend/src/lib/api.js` and both `.env.example` files — already
  correctly env-driven with a dev-only fallback. No change needed.
- `frontend/public/sitemap.xml` and `frontend/public/robots.txt` —
  **genuinely hardcoded.** These are static files Vite copies into
  `dist/` unprocessed (they can't read `import.meta.env` like the rest
  of the app), so they had `http://localhost:5173` baked directly into
  every URL — which would ship straight to production and be served to
  every search crawler as-is. Fixed by adding
  `frontend/scripts/generate-seo-files.js`, wired up as an npm
  `postbuild` step, which rewrites the *built* copies in `dist/` using
  `VITE_SITE_URL` (see Step 2). The checked-in source files in
  `public/` are left untouched — `dist/` is gitignored, so nothing
  gets permanently overwritten, and a build with `VITE_SITE_URL` unset
  is a safe no-op that keeps the existing localhost default.

No other hardcoded localhost/127.0.0.1 references were found in either
app's source.

## Port handling (confirmed)

`backend/src/index.js` reads `PORT` directly from `process.env.PORT`
with no hardcoded fallback and no hardcoded `5050` anywhere in the
listen call — this already matches Render's requirement that the app
bind to whatever port Render assigns at runtime. `PORT` is also in the
required-env-vars list in `backend/src/lib/env.js`, so the server
fails fast with a clear error instead of a confusing crash if it's
ever missing (e.g. a local `.env` without it).

## Build/start commands — confirmed working from a clean install

Both verified from an actual clean state (deleted `node_modules` and
`dist`, reinstalled from scratch):

- **Backend**: `npm install && npm start` — starts cleanly, `GET
  /api/health` returns `{"status":"ok","service":"SettleNG API"}`.
- **Frontend**: `npm install && npm run build` — produces a working
  `dist/` with no build errors (one pre-existing, unrelated warning
  about the main JS chunk being over 500kB after minification — a
  performance note, not an error, and out of scope for this phase).
  `npm run preview` serves that exact `dist/` build and was confirmed
  working (`/`, `/sitemap.xml`, `/robots.txt` all return 200).

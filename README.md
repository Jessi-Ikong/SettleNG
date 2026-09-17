# SettleNG — Nigeria Housing & Rental Marketplace

## What this is

A Nigeria-focused housing/rental marketplace web app. It helps people —
especially those relocating to a new state with no local network — find
legitimate rental listings, verify who they're dealing with, understand
the real cost of moving in, and schedule inspections, all in one place.

Full MVP scope and long-term vision live in the project's master spec
(referenced in planning chat, not duplicated here to avoid drift — ask
before assuming a feature is in scope if it's not listed in "MVP phases"
below).

## Team / workflow

This project is built by a three-person team:
- **Product owner** — makes product decisions, reviews and tests output
- **Claude (chat)** — plans features, writes detailed prompts for each task
- **Claude Code (terminal)** — implements each prompt, runs commands, edits files

Claude Code should read this file at the start of a session for context.
After completing a task, log what you tested in `test.txt` (format below)
before reporting back.

## Tech stack — hard rules

- **Frontend**: React (Vite). Use ES module `import`/`export` syntax
  ONLY. Never use `require`/`module.exports` — do not mix CommonJS and
  ESM in the same project.
- **Backend**: Node.js + Express. Runs on **port 5050**. Do not default
  to 3000/5000/8000 — 5050 is fixed for this project (avoids clashing
  with common local dev ports).
- **Database**: PostgreSQL via Supabase.
- **Storage**: Supabase Storage (property photos/videos).
- **Realtime**: Supabase Realtime (chat) — final decision pending vs.
  Socket.IO; default to Supabase Realtime unless told otherwise.

## Running locally

From `backend/`:
- `npm run dev` — development, auto-restarts on file changes (nodemon)
- `npm start` — plain `node src/index.js`, no auto-restart

From `frontend/`: `npm run dev` (Vite dev server).

## Design system

Brand: **SettleNG** — "Find a place, verified before you move."

Colors (use these exact hex values, referenced as CSS variables —
do not substitute similar-looking colors):
- `--color-indigo: #17304A` — primary brand, headers, nav, primary text on light bg
- `--color-brass: #C68A2E` — verification badges/stamps, primary CTA
- `--color-rust: #A8442D` — secondary accent, used sparingly (warnings/urgency only)
- `--color-bg: #EDEAE2` — page background
- `--color-ink: #211D18` — body text (not pure black)
- `--color-success: #3F6B3F` on `--bg-success: #EAF3DE` — "available"/verified states

Typography:
- Headlines: **Archivo** (weight 800/900)
- Body/UI: **Work Sans** (weight 400/500)

Visual motifs:
- Location breadcrumb ("signpost trail"): angled tab chips, not plain text breadcrumbs
- Verification badge: circular stamped seal in brass, not a generic checkmark icon

## Location hierarchy

`State → LGA → Ward → Neighborhood → Street → Property`

- **States + LGAs + Wards**: seeded nationwide at launch from authoritative
  open data (HDX/GRID3 admin boundaries, cross-checked against INEC ward
  lists). One-time import, not built by hand.
- **Neighborhoods + Streets**: NOT pre-seeded. Agents/landlords add these
  when creating a listing; admin has a merge/dedupe tool to catch
  duplicates ("Ajah" vs "AJAH" vs "Ajah Lagos").
- Admins can enable/disable operation in a given state — schema and code
  should support all of Nigeria from day one, but only Lagos is "live"
  at launch.

## MVP phases (build in this order)

1. Auth — registration, login, roles (tenant / landlord / agent / admin)
2. Properties — CRUD, images, pricing breakdown, location, amenities
3. Search — location filters, price, bedrooms, type, amenities, sorting, pagination
4. Saved properties — favorites, saved searches
5. Inspections — request, accept, reject, reschedule, cancel, complete
6. Messaging — property-specific tenant ↔ landlord/agent chat
7. Verification — phone + admin manual review first; KYC provider integration later
8. Reports — report listing/user, admin moderation queue
9. Reviews — verified-interaction-only reviews

Payments, maps, price intelligence, roommate matching, and everything
else in the long-term vision come after these phases are solid.

## Cost transparency rule (non-negotiable)

Every property listing must show a full move-in cost breakdown (rent +
agency fee + agreement fee + caution fee + service charge + other),
never just the headline rent figure. Where a fee is unknown, show it as
"not provided" — never estimate or invent a number.

## Security rules

- Never trust `user_id`, `role`, `vendor_id`, or `price` values sent
  from the frontend for anything sensitive — the server determines
  these from the authenticated session, not the request body.
- Passwords hashed, ownership checks on every property mutation,
  webhook signature verification once payments are added.
- CORS is an explicit allowlist read from `ALLOWED_ORIGINS`
  (comma-separated) in `backend/.env`, never a wide-open `cors()`.
  Currently just `http://localhost:5173` — add the real production
  origin(s) to that list once a production domain exists.
- Rate limiting on any route behind `requireAuth` keys by the
  authenticated user's id, not by IP. This is a direct fix for a real
  fairness bug, not a stylistic choice: IP-based limiting means every
  user behind the same carrier-grade NAT or shared office/campus
  connection — extremely common on Nigerian mobile networks — draws
  from one shared budget, so a handful of active tenants on the same
  network can lock everyone else on it out of the app. Keying by user
  id gives each account its own independent budget regardless of who
  else shares its network. Only genuinely pre-authentication routes
  (nothing behind `requireAuth` — e.g. `GET /api/locations/*`, the
  Paystack webhook) fall back to IP, since there's no user id yet at
  that point. See `backend/src/middleware/rateLimiters.js`.

## File-sharing convention

When only some files changed, send just those individual files, not a
full project zip.

# Derma Skincare — Project Context for Claude Code

## Stack
- Backend: Flask (app factory pattern) + SQLAlchemy + Flask-JWT-Extended, in `backend/`
- Frontend: React (Vite) + Tailwind, in `frontend/`
- Database: PostgreSQL on Supabase
- Payments: M-Pesa Daraja (STK Push), sandbox mode
- Email: Brevo · Images: Cloudinary
- Dev environment: WSL: Ubuntu, VS Code Remote-WSL

## Running locally
- Backend: `cd backend && source d-venv/bin/activate && flask run` (port 5000)
- Frontend: `cd frontend && npm run dev` (port 5173, sometimes bumps to 5174/5175 if a stale process is still holding 5173)
- Both must run simultaneously in separate terminals for the app to work end-to-end.

## Known gotchas (learned the hard way — don't repeat these)
1. **Supabase connection pooling**: `DATABASE_URL` in `backend/.env` MUST use the
   **Transaction pooler (port 6543)** for `flask run` — Session mode (port 5432)
   hard-caps at 15 connections project-wide and gets exhausted fast during dev
   (multiple stray `flask run` processes each hold a connection open). Only
   switch to port 5432 temporarily for `flask db migrate`/`flask db upgrade`,
   then switch back.
2. **CORS origins**: `FRONTEND_ORIGIN` in `backend/.env` is a comma-separated
   list covering `localhost` AND `127.0.0.1` on ports 5173-5175, since Vite
   falls back to a new port if 5173 is busy, and the browser treats
   `localhost` and `127.0.0.1` as different origins even though they're the
   same machine.
3. **M-Pesa sandbox testing**: ALWAYS use the official sandbox test phone
   number `0708374149` (or `254708374149`) — never a real personal number.
   Sandbox doesn't fully simulate the network layer for real MSISDNs and can
   trigger a genuine balance check against a real account.
4. **ngrok URL changes on every restart** (free tier) — `MPESA_CALLBACK_URL`
   in `.env` must be updated and Flask restarted every time ngrok restarts.
5. Special characters in `DATABASE_URL`'s password (like `@`) must be
   percent-encoded (`@` → `%40`) or the connection string parser misreads
   where the host begins.

## Architecture notes
- Routines (not standalone products) are the core sell: `Routine` has ordered
  `RoutineStep`s, each pointing at a `Product`. See `backend/app/models/routine.py`.
- Orders have a payment-status state machine: `pending` → `payment_pending`
  (STK push sent) → `paid` / `payment_failed`. Cancelling a `payment_pending`
  order requires querying Safaricom's live status first (see
  `cancel_order` in `backend/app/routes/orders.py`) — never trust local
  state alone for an in-flight M-Pesa transaction.
- Design tokens (colors, fonts) are in `frontend/tailwind.config.js` —
  `amber` (brand CTA color, from the actual dropper-bottle packaging),
  `sage` (barrier/biology accent), `mono` font for ingredient concentrations.

## Conventions
- Backend: Flask blueprints per resource in `backend/app/routes/`, models in
  `backend/app/models/`, third-party integrations isolated in
  `backend/app/services/`.
- Frontend: pages in `frontend/src/pages/`, shared state in
  `frontend/src/context/` (Auth, Cart), signature reusable component is
  `RoutineStepRail.jsx`.

  ## Working style
I'm learning as I build this project. Unless I explicitly ask you to make
an edit yourself, act as a mentor: explain what needs to change, give me
the exact file path and exact code, and explain the reasoning — then let
me type it myself and confirm before you move on.
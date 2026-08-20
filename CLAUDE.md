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


## Admin Dashboard Implementation (in progress)

### Why
The admin backend only covered products/routines/concerns/images
(`backend/app/routes/admin.py`) — no order management, no user management,
no admin UI at all in the frontend. Building a dashboard so admins can run
orders through a delivery pipeline (paid → processing → shipped →
delivered, Jumia/Kilimall-style, with a proof-of-delivery photo) and
promote/demote other users to admin, reusing existing patterns rather than
inventing new ones: the `mpesa_service.query_stk_status` live-check pattern
from `cancel_order`, the Cloudinary upload flow, the per-page hand-rolled
React convention (no Button/Modal/Table component library in this repo).

### Scope decisions (confirmed with user, not open for re-litigation)
1. Admin promotion/demotion of other users happens via the new UI/API, not
   flask-shell-only. This supersedes the `backend/README.md` "no signup
   flow for admins by design" line. The very first admin still has to be
   bootstrapped via `flask shell` (chicken-and-egg — nobody can call an
   admin endpoint before being an admin).
2. No separate delivery-personnel role. Any admin advances orders and
   uploads the proof-of-delivery photo themselves — no rider app, no
   restricted third role.

### Backend design
- `Order.delivery_proof_public_id` (nullable string) — new column.
- `Order.to_dict(include_admin_fields=False)` — when `True`, adds `user_id`
  and `user_email` (via the existing `User.orders` backref). Always
  includes `delivery_proof_public_id`.
- `backend/app/utils/order_transitions.py` — `can_advance(current, new)`
  (true only for the exact next step in
  `paid → processing → shipped → delivered`) and
  `can_cancel(current)` (true for `paid`/`processing`/`shipped`;
  `delivered` is terminal).
- `backend/app/routes/admin.py` new endpoints:
  - `GET /api/admin/orders` (optional `?status=`), `GET /api/admin/orders/<id>`
  - `POST /api/admin/orders/<id>/refresh-payment-status` — live Daraja check
    via `mpesa_service.query_stk_status`, same branching as `cancel_order`
    in `backend/app/routes/orders.py` (`None`→leave, `"0"`→`paid`,
    else→`payment_failed`). No-op unless status is `payment_pending`.
  - `POST /api/admin/orders/<id>/advance` — body
    `{status, delivery_proof_public_id?}`; `can_advance()` gates it;
    `delivery_proof_public_id` required when advancing to `delivered`.
  - `POST /api/admin/orders/<id>/cancel` — gated by `can_cancel()`.
  - `GET /api/admin/users` — via new private `_user_admin_dict()` (adds
    `created_at`, `order_count`; does not touch the public `User.to_dict()`).
  - `PATCH /api/admin/users/<id>` — body `{is_admin}`; blocks
    self-demotion with a 400 if the caller tries to unset their own
    `is_admin`.
- `upload_product_image()` now accepts an optional `folder` form field so
  delivery-proof photos can land in `derma-skincare/delivery-proofs`
  instead of mixing into the products folder.
- Docs still need updating to match: `backend/README.md` admin section +
  route table, and the stale "no signup flow for admins" docstring in
  `backend/app/utils/decorators.py`.

### Frontend design (not started yet)
- `frontend/src/components/AdminRoute.jsx` — first route-guard in the
  codebase (today's auth-gating is inline per-page, e.g. `Account.jsx`).
  Redirects non-logged-in to `/login`, non-admin to `/`.
- `frontend/src/App.jsx` — nested `/admin/*` routes (React Router 6.26 is
  already installed, supports `<Outlet/>`), scoped only under `/admin` so
  the rest of the flat route list stays untouched.
- New folder `frontend/src/pages/admin/`: `AdminLayout.jsx` (tab nav +
  `<Outlet/>`), `AdminOrders.jsx`, `AdminOrderDetail.jsx`,
  `AdminProducts.jsx`, `AdminRoutines.jsx`, `AdminUsers.jsx` — all following
  the existing page convention (local `useState`/`useEffect`/`client.get`,
  `loading` boolean, per-item keyed action state,
  `err.response?.data?.error` for messages).
- `frontend/src/components/ImageUploadField.jsx` — the one new shared
  primitive (reused by products, routines, and delivery-proof upload);
  everything else stays hand-rolled per page per existing convention.
- `Navbar.jsx` — one-line admin link, shown only when `user.is_admin`.

### Build order
1. ~~`Order` model + migration~~ — done. Migration
   `f36c3194ac93_add_delivery_proof_public_id_to_orders.py` generated and
   applied via `flask db upgrade` (session pooler override used only for
   the migrate/upgrade commands themselves, `.env` was never edited).
2. ~~`order_transitions.py` helper~~ — done.
3. ~~Admin order endpoints in `admin.py`~~ — done (`GET /orders`,
   `GET /orders/<id>`, `POST /orders/<id>/refresh-payment-status`,
   `POST /orders/<id>/advance`, `POST /orders/<id>/cancel`).
4. ~~Admin user endpoints in `admin.py`~~ — done (`GET /users`,
   `PATCH /users/<id>`).
5. README / docstring updates — not done.
6. `AdminRoute` + nested routes + `AdminLayout` + Navbar link — not started.
7. `ImageUploadField` — not started.
8. `AdminProducts.jsx` — not started.
9. `AdminRoutines.jsx` — not started.
10. `AdminUsers.jsx` — not started.
11. `AdminOrders.jsx` + `AdminOrderDetail.jsx` — not started.

### Progress as of 2026-08-20 — resume here
**Done** (uncommitted, in the working tree, except the migration which is
already applied to the live Supabase DB):
- `backend/app/models/order.py` — `delivery_proof_public_id` column +
  `to_dict(include_admin_fields=...)`.
- `backend/app/utils/order_transitions.py` — new file, `can_advance`/`can_cancel`.
- `backend/app/routes/admin.py` — imports updated (`Order`, `User`,
  `mpesa_service`, `get_jwt_identity`, `can_advance`/`can_cancel`);
  `upload_product_image()` now takes an optional `folder` field; full
  `# ---------- Orders ----------` and `# ---------- Users ----------`
  sections added with all 7 new routes.
- `backend/migrations/versions/f36c3194ac93_add_delivery_proof_public_id_to_orders.py`
  — generated and applied.

**Verified** (2026-08-20, full curl pass against a restarted `flask run`):
all 7 new routes behave correctly — status-transition guards (illegal/skip
transitions blocked with 400), delivered-requires-proof, terminal-state
cancel block, self-demote block, missing-field validation, 401 without a
token, and `refresh-payment-status` correctly resolved a real stuck
sandbox order (`dbd2f5e6...`, the one with no Safaricom callback from
earlier in the session) from `payment_pending` to `payment_failed`. Dev-DB
note: order `ce5f188c...` was deliberately flipped `cancelled → paid` and
run through the full pipeline to `delivered` (with a fake
`delivery_proof_public_id`) purely as test data — not a real order.

**Frontend — built and browser-verified (2026-08-20)**:
`AdminRoute.jsx`, nested `/admin` routes in `App.jsx`, `AdminLayout.jsx`,
`pages/admin/{AdminOrders,AdminOrderDetail,AdminProducts,AdminRoutines,AdminUsers}.jsx`,
`ImageUploadField.jsx`, Navbar admin link. Confirmed working end-to-end by
eye in the browser: Products edit form pre-fills correctly, Orders list +
status filter work (incl. isolating the one `delivered` test order),
Routines list/steps/edit render, Users page shows the self-demote guard
actually disabled in the UI (not just blocked server-side).

**Docs — done**: `backend/README.md` and `decorators.py` docstring updated
to describe UI-based promote/demote instead of "no signup flow for admins."

**Whole admin feature is now functionally complete.** Remaining loose ends,
not blockers:
- Everything is uncommitted in the working tree — no commit has been made.
- `Account.jsx` had an unrelated pre-existing syntax break (a string
  literal split across two lines during a manual edit) that was fixed
  along the way — worth a quick sanity look since it wasn't part of this
  feature.
- No automated frontend tests were added — verification was manual
  (backend: curl pass; frontend: browser click-through).
- Restock-on-cancel (noted below) is still open and unrelated to admin.

### Other known open items (unrelated to the admin work above)
- Stock is decremented on payment (`payments.py` `mpesa_callback`, via
  `backend/app/utils/inventory.py:stock_lines`) but never restored when an
  order is cancelled or a payment fails — no restock-on-cancel logic yet.
- `Account.jsx`'s payment-timeout branch was fixed to show a real message
  instead of the literal string `"error"` — done. The inline comment on
  line 12 (`// orderId -> "sending" | "awaiting_pin" | "error"`) is now
  stale wording (state can be any human-readable string) but harmless.

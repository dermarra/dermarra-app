# Dermarra Skincare — Project Context for Claude Code

## Stack
- Backend: Flask (app factory pattern) + SQLAlchemy + Flask-JWT-Extended, in `backend/`
- Frontend: React (Vite) + Tailwind, in `frontend/`
- Database: PostgreSQL on Supabase
- Payments: M-Pesa Daraja (STK Push), sandbox mode
- Email: Brevo · Images: Cloudinary
- Dev environment: WSL: Ubuntu, VS Code Remote-WSL

## Running locally
- Backend: `cd backend && source dermarra-venv/bin/activate && flask run` (port 5000)
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
- **`Product` is a catalogue family, `ProductVariant` is the sellable/
  stockable unit** (see "ProductVariant" below for the full migration) —
  `price_cents`/`currency`/SKU live on the variant, not the product.
  `Cart`/`Order` items, `Inventory`/`InventoryBatch`/etc., and
  `RoutineStep` all key off `variant_id`, not `product_id`.
- Routines (not standalone products) are the core sell: `Routine` has ordered
  `RoutineStep`s, each pinned to a specific `ProductVariant` (a curated
  bundle names an exact size, not just a product family). See
  `backend/app/models/routine.py`.
- Product taxonomy, all in `backend/app/models/product.py`: `SkinConcern` and
  `Ingredient` are open-ended, admin-manageable tags (many-to-many with
  `Product` via `product_concerns`/`product_ingredients`); `StepGroup` is a
  fixed 4-row taxonomy (prep/treat/seal/protect, seeded by migration) for the
  "Shop by Step" section — admin can edit but not create/delete rows.
  `Product.step_type` itself is a 4-value soft enum (`cleanser`, `serum`,
  `barrier_cream`, `spf`); the former `hair` step type was dropped.
- `Routine.skin_type` (nullable) is a second quiz-matching dimension
  alongside `primary_concern_id`. `POST /api/routines/quiz` matches in three
  tiers so it never refuses a match just because the catalog isn't fully
  tagged yet: exact concern+skin_type → concern match on a skin_type-agnostic
  routine → any active routine for that concern.
- Orders have a payment-status state machine: `pending` → `payment_pending`
  (STK push sent) → `paid` / `payment_failed`. Cancelling a `payment_pending`
  order requires querying Safaricom's live status first (see
  `cancel_order` in `backend/app/routes/orders.py`) — never trust local
  state alone for an in-flight M-Pesa transaction. Stock is *reserved* at
  checkout and *consumed* (FEFO-allocated) only once `paid` is confirmed,
  reversed via `restock_order()` when an admin cancels a `paid`/`processing`/
  `shipped` order (`delivered` is terminal, see `order_transitions.py`) —
  see "Inventory Management" below for the mechanics; `order_transitions.py`
  itself stays a pure guard module, all inventory side effects are called
  from the route handlers (`orders.py`/`payments.py`/`admin.py`).
- `User` carries `default_shipping_*` fields (name/address/city/country/
  postal_code/phone) editable via `PATCH /api/auth/me`; `Checkout.jsx`
  prefills from these and can save the entered address back through the same
  endpoint, reflecting the response into `AuthContext` via `updateUser()`
  rather than forcing a re-login.
- Design tokens (colors, fonts) are in `frontend/tailwind.config.js` —
  `amber` (brand CTA color, from the actual dropper-bottle packaging),
  `sage` (barrier/biology accent), `mono` font for ingredient concentrations.

## Conventions
- Backend: Flask blueprints per resource in `backend/app/routes/`, models in
  `backend/app/models/`, third-party integrations isolated in
  `backend/app/services/`.
- Frontend: pages in `frontend/src/pages/`, shared state in
  `frontend/src/context/` (Auth, Cart), signature reusable component is
  `RoutineStepRail.jsx`. Nested-route sections (`/account/*`, `/admin/*`)
  each get a `*Layout.jsx` with tab nav + `<Outlet/>` — `AccountLayout.jsx`
  (`frontend/src/pages/account/`) mirrors the earlier `AdminLayout.jsx`
  pattern. Route guarding is `AdminRoute.jsx`-style (redirect non-logged-in
  to `/login`, unauthorized to `/`) — there's no equivalent guard needed for
  `/account` since it's available to any logged-in user.
- Shared UI primitives: `ImageUploadField.jsx` (Cloudinary upload; pass an
  `aspect` prop to require a `react-easy-crop` crop step first — via
  `frontend/src/lib/imageCrop.js` — otherwise it uploads immediately, e.g.
  delivery-proof photos), `Icons.jsx` (small inline feather-style icon set),
  `Reveal.jsx` (`framer-motion` scroll-triggered stagger reveal wrapper,
  `containerReveal`/`itemReveal` variants, used across the storefront).

## Admin Dashboard (shipped)
Committed across `bb3696c`, `7860e21`, `9ce60ec`, `d0a28cb`, `f821d77`. Admins
run orders through a delivery pipeline (`paid → processing → shipped →
delivered`, Jumia/Kilimall-style, with a proof-of-delivery photo —
`Order.delivery_proof_public_id`) and promote/demote other users to admin —
via the UI/API now, not flask-shell-only (the very first admin still has to
be bootstrapped via `flask shell`, chicken-and-egg). No separate
delivery-personnel role: any admin advances orders and uploads the proof
photo themselves. Guarded by `order_transitions.py`'s `can_advance`/
`can_cancel` (see Architecture notes above), live payment status checks
reuse the `mpesa_service.query_stk_status` pattern from `cancel_order`, and
`frontend/src/components/AdminRoute.jsx` is the route-guard convention now
also used to gate `/admin/*`. Full route list and details are in
`backend/README.md`'s admin section — refer there rather than duplicating
it here.

## Inventory Management (shipped)
Replaces the old `Product.stock_quantity` int column entirely (dropped,
not cached) with proper batch/lot tracking. Models in
`backend/app/models/inventory.py`: `Inventory` (on_hand/reserved per
product, `available` computed not stored), `InventoryBatch` (one per
production run — Dermarra Skincare manufactures in-house, so there's no
supplier/vendor concept anywhere in this model; `unit_cost_cents` is
internal production cost, `expiry_date` is nullable for non-expiring
products), `InventoryTransaction` (append-only audit ledger, never
edited — corrections get a new row), `InventoryReservation` (a hold on
`Inventory.reserved`, created at checkout, resolved to consumed/released/
expired). All mutation goes through
`backend/app/services/inventory_service.py` — never write these tables
directly from a route.
- **FEFO**: consumption always draws from the earliest-`expiry_date`
  active batch first; non-expiring batches (`expiry_date IS NULL`) sort
  last under Postgres's default `ASC` ordering, so they're only drawn from
  once every dated batch is exhausted. Never allocates an expired batch.
- **Concurrency**: reservation creation locks each product's `Inventory`
  row with `SELECT ... FOR UPDATE` (sorted by product id, to avoid
  deadlocks across multi-product orders) — not an app-level
  check-then-write — so two concurrent checkouts can never both reserve
  the last unit.
- **Reservation expiry**: no Celery/APScheduler exists in this project, so
  expiry is lazy (checked whenever a new reservation is made) plus
  `POST /api/admin/inventory/expire-reservations` for an external cron or
  manual sweep.
- **Idempotency**: the M-Pesa callback's existing `order.status != "paid"`
  guard, plus `consume_reservations_for_order` itself being a no-op once a
  reservation is already `consumed`, means a duplicate Safaricom webhook
  delivery can't double-deduct stock.
- Admin endpoints under `/api/admin/inventory/*` (list w/ stock status,
  per-product detail with batches + ledger, receive/log a production run,
  manual adjustment requiring a reason, low-stock, expiring-soon, reservation
  cleanup) — full list in `backend/README.md`. Admin UI:
  `frontend/src/pages/admin/AdminInventory.jsx` (list) and
  `AdminInventoryDetail.jsx` (batches/ledger/receive-form/adjust-form with
  a review-then-confirm step). Customers only ever see
  `Product.stock_status` (`in_stock`/`low_stock`/`out_of_stock`) — never
  batch numbers, unit cost, or the transaction ledger.
- **Verified** (2026-08-24): migration `a9322b7ec397` applied to the dev
  DB — backfilled every existing product's `stock_quantity` into an
  `Inventory` row + one legacy `InventoryBatch` + a `PRODUCTION_RECEIPT`
  ledger entry, checked against a pre-migration snapshot with no
  discrepancy. `backend/tests/test_inventory.py` (pytest, run against the
  real dev DB — no separate test DB exists yet, see `conftest.py`) covers
  reservation concurrency (proved B actually blocks on A's row lock, not
  just got lucky on timing), FEFO splitting + expired-batch exclusion,
  idempotent double-consumption, release, and restock reversal — 8/8
  passing across multiple consecutive full-suite runs. All admin
  endpoints additionally curl-tested against a live `flask run`. Note:
  this session saw the suite intermittently hang/fail once each in two
  separate runs (different tests each time, never the same one twice,
  and independent tool calls in this environment were timing out at the
  same time) — traced to test infrastructure (a fresh `create_app()`
  engine per test was leaking connections; the `app` fixture is now
  session-scoped) and likely transient environment/network flakiness
  rather than a bug in the inventory logic itself, since every assertion
  that did complete was correct in every run. Worth a re-run if it's ever
  seen again rather than assumed fixed for good.

## Catalog Taxonomy, Account Self-Service & Storefront Rebrand (shipped)

### Why
Follow-on work after the admin dashboard: give the storefront proper
browse-by facets (concern/ingredient/step, not just a flat product list),
let customers manage their own profile/shipping/password/order history
instead of the single flat `Account.jsx`, let the quiz account for skin
type and not just concern, and give the landing/shop pages a visual pass
(motion, consistent iconography) to match the `53c9ad6` rebrand.

### What's in the working tree right now
- **Backend**: `Ingredient` model + `product_ingredients` join table,
  `StepGroup` model (see Architecture notes), `SkinConcern` gains
  `cloudinary_public_id`, `Routine` gains `skin_type`, `User` gains
  `default_shipping_*` fields, `OrderItem.to_dict()` now exposes
  `product_id`/`routine_id`. Four new migrations in
  `backend/migrations/versions/` (`bdec962eaa7c`, `07244c98c0f6`,
  `46f80398af62`, `2a735e468547`) — part of the single linear migration
  chain confirmed applied and live in production (see "Current
  Implementation Status" below).
- **New/changed endpoints**: `GET /api/products/ingredients`,
  `GET /api/products/step-groups`, `?ingredient=` filter on
  `GET /api/products`; admin CRUD for ingredients (mirrors concerns) and
  PATCH-only for step-groups (fixed set, no create/delete — see model
  docstring); `POST /api/routines/quiz` takes an optional `skin_type`;
  `PATCH /api/auth/me` (profile + shipping defaults) and
  `POST /api/auth/change-password`.
- **Frontend routing**: `ConcernShop.jsx`/`IngredientShop.jsx`/`StepShop.jsx`
  at `/shop/concern/:slug`, `/shop/ingredient/:slug`, `/shop/step/:key`.
  `Account.jsx` deleted, replaced by `frontend/src/pages/account/`
  (`AccountLayout`, `AccountProfile`, `AccountRoutines`, `AccountOrders`,
  `AccountOrderDetail`) nested under `/account/*` — see Conventions above.
  New admin pages `AdminConcerns.jsx`, `AdminIngredients.jsx`,
  `AdminStepGroups.jsx`.
- **RoutineQuiz.jsx**: gained a second step asking skin type before showing
  a result.
- **Checkout.jsx**: prefills shipping from `user.default_shipping` and can
  save an entered address back (see Architecture notes above).
- **Visual pass**: `framer-motion` now used in `Navbar`/`BottomNav`/
  `ProductCard`/`RoutineStepRail`/`Home`/etc.; new shared `Icons.jsx` and
  `Reveal.jsx` (see Conventions above); `ImageUploadField.jsx` gained an
  optional crop step (`react-easy-crop` + `frontend/src/lib/imageCrop.js`).
  `ProductCard.jsx` also gained a quick-add-to-cart button.

### Status
- **Committed and shipped** (`1fb2a3e`, "Add catalog taxonomy, account
  self-service, and storefront rebrand") — confirmed live in production as
  of the 2026-09-18 audit (see "Current Implementation Status" below). The
  "Not done yet" framing that used to live here was stale; correcting it
  here rather than leaving future sessions to re-discover this from
  scratch.
- `backend/README.md` / `frontend/README.md` still don't reflect all of
  the above (new endpoints, dropped `hair` step type, new models) as of
  last check — still an open doc-drift item.
- Still **no automated tests** for this batch specifically (auth,
  catalog/taxonomy, account self-service) — the only backend tests that
  exist anywhere in the project cover inventory logic only (see "Current
  Implementation Status" below). No noted manual click-through of the
  frontend for this batch either — functionality is live and used, but
  formally "unverified by an explicit test pass."

## Landing Page Expansion (shipped)

### Why
A large redesign spec covering the homepage hero, footer, wishlist, and a
richer product card. Two pieces of that spec were **explicitly deferred**
rather than guessed at, because they're architecture decisions, not
implementation details:
- **Product size/variant selector** (multiple sizes per product, each
  with its own price) — `Product.price_cents` is still a single price per
  product; there is no `ProductVariant` model. Building one means deciding
  whether `Inventory`/`InventoryBatch` key off the variant or stay
  product-level, which ripples into the just-shipped reservation/FEFO
  system (see "Inventory Management" above) — not attempted without that
  decision.
- **"Become a member" signup discount** — the homepage section (copy +
  CTA to `/signup`) is built, but applies no actual discount. No
  coupon/discount-code model exists anywhere (the only discount mechanic
  in the app is `Routine.bundle_discount_percent`, a fixed per-routine
  bundle discount). Needs a choice between a hardcoded first-order
  discount at checkout vs. a real admin-editable `Coupon` model before
  wiring real money off checkout.
- `ProductCard.jsx`'s "application text" and full-width add-to-cart-below-
  the-card restyle were left as-is pending the variant decision above,
  since a variant selector changes the card's layout anyway.

### What's in the working tree right now
- **Backend**: new `HeroSlide` model (`backend/app/models/hero_slide.py`,
  admin-managed homepage carousel content — free-text `cta_link`, not FK'd
  to a Product, so it can point anywhere), new `Wishlist`/`WishlistItem`
  models (`backend/app/models/wishlist.py`, mirrors `Cart`/`CartItem`),
  `Ingredient` gains `cloudinary_public_id` (it had no cover photo before,
  unlike `SkinConcern`/`StepGroup`). One new migration
  (`189c5136da45`) — **applied** to the dev DB this session.
- **New endpoints**: `GET /api/hero-slides` (active only, position order),
  full admin CRUD at `/api/admin/hero-slides/*`; `GET /api/wishlist`,
  `POST /api/wishlist/items`, `DELETE /api/wishlist/items/<id>` and
  `.../by-product/<product_id>` (the latter for a one-click heart
  toggle); `POST /api/newsletter/subscribe` wires the previously-unused
  `brevo_service.add_contact_to_list()` to a real endpoint — needs
  `BREVO_NEWSLETTER_LIST_ID` set in `.env` or it returns 503 (not
  silently swallowed). Admin ingredient create/update now also accept
  `cloudinary_public_id`.
- **Frontend**: `HeroCarousel.jsx` (auto-advancing, animated per-slide
  text via `AnimatePresence`, fills `h-[calc(100vh-4rem)]` — 4rem matches
  `Navbar.jsx`'s `h-16`) — `Home.jsx` renders it only when
  `GET /api/hero-slides` returns slides, otherwise falls back to the
  original static hero, so the homepage is never hero-less before an
  admin adds slides. New `AdminHeroSlides.jsx` (admin CRUD, added to
  `AdminLayout.jsx` tabs). New `WishlistContext.jsx` (mirrors
  `CartContext.jsx`, wrapped in `main.jsx` inside `CartProvider`) — heart
  toggle added to `ProductCard.jsx`, a `wishlist` tab added to
  `AccountLayout.jsx` (`AccountWishlist.jsx`, just re-renders
  `ProductCard` for each saved product). New `Breadcrumbs.jsx`, wired into
  `ConcernShop.jsx`/`StepShop.jsx`/`IngredientShop.jsx` (`IngredientShop`
  also gained the hero background image the other two already had, now
  that `Ingredient` has a cover photo). New `Footer.jsx` (quick links,
  social links, logo, newsletter form, copyright) rendered once at the
  bottom of `App.jsx`'s `<main>` — shows on every route including
  `/admin/*`, matching how `BottomNav` was already unconditional; two new
  placeholder pages `Terms.jsx`/`Privacy.jsx` so the footer's legal links
  don't 404 (real copy still needed). `Home.jsx` gained a "Shop by
  ingredient" teaser section (mirrors the existing concern/step teasers,
  was previously missing even though the destination page existed) and a
  "Become a member" marketing section (see deferred item above).

### Verified
Migration `189c5136da45` applied (session pooler, then switched back to
transaction pooler — see gotcha #1). Confirmed via direct Flask route
introspection that every new route registers. `npm run build` passes.
Live-curl-tested against a temporary `flask run --port 5001` (kept
separate from the user's own running dev server on 5000, which was left
untouched and needs a restart to pick up these changes — its
autoreloader did not appear to catch the new blueprint registrations):
wishlist add/idempotent-re-add/remove, hero slide create via admin →
appears in the public endpoint → delete, newsletter invalid-email
rejection and the "not configured" 503 path. Not verified: an actual
successful Brevo newsletter subscribe (no `BREVO_NEWSLETTER_LIST_ID` set
in this dev `.env`), and no in-browser click-through of any of the new
UI (hero carousel animation, wishlist heart, footer form) — only API-level
verification this session.

### Auth pages: split layout + forgot/reset password
`Login.jsx`/`Signup.jsx`/`ForgotPassword.jsx`/`ResetPassword.jsx` (the
latter two new) all now share a `grid lg:grid-cols-2` layout: the left
column is `AuthPromoPanel.jsx`, a compact sliding banner that **reuses
the same `/api/hero-slides` data as the homepage carousel** (see "Hero
carousel" above) rather than a separate content model — one carousel for
admins to manage, shown in two places. Hidden below `lg`; falls back to a
plain branded panel if no slides exist, same defensive pattern as
`HeroCarousel`.

Password reset uses `backend/app/utils/tokens.py` — deliberately
**not** a `flask_jwt_extended` access token. A JWT issued via
`create_access_token` would pass `@jwt_required()` on *any* protected
route if it leaked, which matters more than usual here since a reset
link travels over email. Instead it's an `itsdangerous.URLSafeTimedSerializer`
token (bundled with Flask already), scoped to a dedicated salt, expiring
after 30 minutes (`RESET_TOKEN_MAX_AGE_SECONDS`). It's also made
**single-use** by embedding a fingerprint (`sha256(password_hash)[:16]`,
never the raw hash — the serializer signs, it doesn't encrypt, so the
payload is base64-readable by whoever holds the link) in the token
payload: once the password actually changes, that fingerprint no longer
matches and the same token stops verifying, with no server-side
revocation table needed. `POST /api/auth/forgot-password` always returns
the same response whether or not the email is registered (no account
enumeration). New `FRONTEND_BASE_URL` config value builds the link
inside the email — distinct from `FRONTEND_ORIGINS`, which is the CORS
allowlist.

**Verified**: full flow curl-tested end-to-end against a disposable test
user (not the real seed account) on the same temporary `flask run --port
5001` — forgot-password with an unregistered email (generic response,
no error), reset with too-short password (400), reset with a garbage
token (400), reset with a valid token (200), login with the new password
(succeeds) and the old one (fails). Also specifically re-verified the
single-use property after finding it *didn't* hold on the first
implementation pass (a bare-user-id token has no way to detect reuse) —
confirmed replaying the same token a second time now correctly fails
with no second password change taking effect. Not verified: no actual
email was sent/received (Brevo call happens inside the same try/except-
swallow pattern as the other transactional emails), no in-browser
click-through of the split layout or the promo panel's animation.

## Email audit (2026-08-24)

Verified the Brevo integration end-to-end rather than just reading the
code. `backend/app/services/brevo_service.py` is now the single place
all 6 transactional emails (welcome, password reset, order confirmation,
shipping update — new, invoice, newsletter contact-add) render through
a shared branded shell and HTML-escape every interpolated field —
confirmed by capturing a real `SendSmtpEmail` object with `<b>`/`'`
characters in a fake user's name and asserting the rendered
`html_content` came out as `&lt;b&gt;...&#x27;`, not raw markup.

**Found and fixed**: every send function only caught
`sib_api_v3_sdk.rest.ApiException`, so a lower-level failure (DNS,
timeout, connection refused) wouldn't get logged before hitting a bare
`except: pass` at the call site — silent with zero trace. All sends now
go through one `_send()` helper that catches and logs any `Exception`.
Also added `send_shipping_update_email` (fires on admin advancing an
order to `shipped`/`delivered`, includes tracking number) — this
lifecycle point had no customer-facing email at all before.

**Found, not a code fix, since resolved**: `BREVO_API_KEY` is valid
(confirmed live via `AccountApi.get_account()`, account
`dermarradev@gmail.com`). A real test send from the configured
`BREVO_SENDER_EMAIL` (`welcome@dermarra.com`) succeeded at the API level,
but `SendersApi.get_senders()` initially showed only
`dermarradev@gmail.com` as a verified sender — Brevo doesn't hard-reject
sends from an unverified address, but Gmail and other strict receivers
commonly spam-box or reject mail from a domain with no SPF/DKIM
authentication, so this mattered. **Resolved 2026-08-25**: user verified
`welcome@dermarra.com` and configured DKIM + DMARC for `dermarra.com` in
Brevo's dashboard — reverified via `SendersApi.get_senders()` (now
`active=True`) and a live `send_welcome_email()` call, both succeeding
from the now-authenticated sender. See `backend/README.md`'s
"Transactional emails" section.

## Deployment prep (2026-08-25)

Backend targets Render, frontend targets Netlify — see the root
`README.md`'s new "Deployment" section for the actual walkthrough; this
is just what changed in the codebase to support it.

- `render.yaml` (repo root, not `backend/` — Render's monorepo blueprint
  convention) declares the web service with `rootDir: backend`,
  `gunicorn wsgi:app` as the start command, and every env var as
  `sync: false` (Render prompts for the value rather than it ever being
  committed) except the ones safe to default in the file itself
  (`FLASK_ENV=production`, `BREVO_SENDER_NAME`, and **`MPESA_ENV=sandbox`
  by default** — deliberately not `production`, so a fresh deploy never
  silently hits real Safaricom endpoints before real Daraja credentials
  exist). Migrations are **not** automated in the blueprint — matches
  this project's existing manual `flask db upgrade` workflow, run once
  via Render's Shell tab after each deploy that adds one.
- `netlify.toml` (repo root, `base = "frontend"`) — build command,
  publish dir, and the SPA fallback redirect (`/* -> /index.html`)
  React Router needs; without it, refreshing any non-root route 404s on
  Netlify since there's no server-side route matching a client-only
  router's paths.
- `backend/app/config.py` gained `validate_production_config()`, called
  from `create_app()` only when `FLASK_ENV=production` — **refuses to
  boot** if `SECRET_KEY`/`JWT_SECRET_KEY` are missing or still at their
  insecure dev fallback (a forged JWT/session is possible otherwise), and
  logs one clear warning (doesn't crash) if Cloudinary/Brevo/M-Pesa
  config is missing, since those gate individual features rather than
  the whole app. Verified both paths directly: a real `RuntimeError` with
  insecure secrets, silent boot with real ones, and the warning firing
  for exactly the vars actually unset.
- Found and fixed two stale/incorrect docs while doing this: the root
  `README.md` had the Supabase pooler names backwards (said "Session
  pooler" for port 6543, which CLAUDE.md's own gotcha #1 already
  correctly identifies as the *transaction* pooler), and
  `frontend/README.md` predated nearly this entire session's work
  (wrong design-token hex values, a reference to the long-deleted
  `Account.jsx`, a "what's next" list that was already built). Fixed the
  factual errors and the most actively-misleading parts; didn't do a
  full exhaustive rewrite of `frontend/README.md`'s file-tree listing —
  worth a fuller pass later if it drifts further.
- `backend/.env.example` was missing `FRONTEND_BASE_URL` and
  `BREVO_NEWSLETTER_LIST_ID` entirely (both added earlier this session,
  never backfilled into the example file) — added, plus fixed the stale
  `BREVO_SENDER_NAME=Derma Skincare` default.

**Not done**: CI (`.github/workflows/ci.yml`) still only lints; it
doesn't run `backend/tests/` (which needs a real Postgres — either an
ephemeral service container or a dedicated test-DB secret would be
needed, since the suite runs against the real dev DB by design today).
Flagged in the root README's Status section rather than implemented, to
keep this batch scoped to hosting prep specifically.

## Repo migration to new GitHub account + Render/Netlify deploy config verified (2026-08-27)

- Project moved to a new GitHub account/org: `dermarra` (repo
  `dermarra-app`), replacing `ColourfulVisualCommunication/derma` as the
  canonical remote — full commit history preserved (pushed as-is, not
  squashed). SSH config reorganized from role-based aliases
  (`github.com-business`/`github.com-personal`) to account-based ones:
  `github.com-cvc` (ColourfulVisualCommunication) is now the alias used
  for all `git` operations on this project; `github.com-njoroge-cvc`
  (the old business account) is retired but kept configured;
  `github-northerniy` unchanged.
- **Found and fixed**: `backend/requirements.txt` was not actually this
  project's dependency file — it was a `pip freeze` dump of Ubuntu
  system packages (`cloud-init`, `ubuntu-pro-client`, `dbus-python`,
  etc.), with zero of the app's real dependencies. Reconstructed from
  actual imports across `app/` cross-checked against the stack described
  in this file; installs cleanly and `flask run` boots and serves
  `/api/health` against it.
- Backend venv renamed `d-venv` → `dermarra-venv` (see "Running locally"
  above); old `d-venv` was already removed from disk.
- **Found and fixed**: CI (`.github/workflows/ci.yml`) had never
  actually been green — pre-existing `flake8` violations (whitespace,
  spacing, line length in `app/config.py`, `routes/orders.py`,
  `routes/payments.py`, `utils/errors.py`) and `eslint`
  `react/no-unescaped-entities` errors (raw apostrophes in JSX text in
  `ForgotPassword.jsx`, `Home.jsx`, `Privacy.jsx`, `Terms.jsx`). Fixed
  all; both jobs verified passing locally (`flake8`, `npm run lint`,
  `npm run build`) before push, then confirmed green on GitHub Actions.
- **Verified**: `render.yaml` and `netlify.toml` reviewed against the
  current codebase and need no changes for the new repo — neither file
  hardcodes a GitHub account/org, since Render/Netlify link to a repo
  via their own dashboards (Render → New → Blueprint, Netlify → Import
  from Git), not via anything committed in-repo. `render.yaml`'s
  `buildCommand` (`pip install -r requirements.txt`) was specifically
  re-checked against the fixed `requirements.txt` above. Root
  `README.md`'s Deployment section doesn't reference the old account
  either, so nothing there needed updating for the migration.
- **Not done**: Render/Netlify services haven't been (re)connected to
  the new `dermarra/dermarra-app` repo yet — to be done via each
  platform's dashboard through the `dermarra` GitHub account directly.

## First live deploy: Render + Netlify go-live (2026-08-27)

Backend deployed at `https://dermarra-backend.onrender.com`, frontend at
`https://dermarra.netlify.app`, both connected directly through their
dashboards to `dermarra/dermarra-app` (no CLI) as planned above.

- **Found and fixed**: `render.yaml` had `plan: starter`, which requires
  Render to have a card on file before it'll even run the Blueprint —
  blocked the first deploy attempt. Changed to `plan: free`. Tradeoff
  worth knowing: the free tier has **no Shell tab access**, so
  `flask db upgrade` after a migration-adding deploy can't be run the
  way `backend/README.md` describes — has to be run from a local machine
  against the production `DATABASE_URL` instead (session pooler, port
  5432, temporarily — same pattern as gotcha #1), not Render's Shell.
- **Verified**: `/api/health` returns 200 but is a static handler with
  no DB query (`app/__init__.py`) — doesn't actually prove Supabase
  connectivity. Used `GET /api/products/step-groups` instead (public,
  DB-backed) and got the real seeded 4-row taxonomy back, confirming
  `DATABASE_URL` on Render is correctly set to a reachable pooler
  connection.
- **Found and fixed**: after both deploys were live, the frontend loaded
  but every API call hit `localhost:5000` instead of the Render backend
  — browser console showed `ERR_CONNECTION_REFUSED` on every request.
  Root cause: `frontend/src/api/client.js`'s
  `import.meta.env.VITE_API_URL || "http://localhost:5000/api"` fallback
  — Vite bakes env vars in at **build time**, not runtime, so setting
  `VITE_API_URL` on Netlify after the first build doesn't retroactively
  fix an already-built JS bundle; a fresh build is required. Confirmed
  via the built bundle's content hash (`index-D952L1ir.js`) staying
  identical across a "Trigger deploy" click — proof the rebuild wasn't
  actually picking up the new env var. **Resolved**: root cause was that
  Vite's environment config wasn't actually set up yet on Netlify at the
  time of the first build. Fixed by the user directly; reverified by
  confirming the bundle hash changed (`index-CMoxebUw.js`) and that its
  contents now reference `dermarra-backend.onrender.com` instead of
  `localhost:5000`.
- Added a real favicon (`frontend/public/favicon.svg`, plus generated
  `favicon.ico`/`favicon-32x32.png`/`apple-touch-icon.png` fallbacks via
  a throwaway `cairosvg`+`Pillow` venv, since no SVG-to-raster tool was
  installed) from the actual brand mark provided
  (`D:\branding\Dermarra Skincare- Description\SVG\Asset 2.svg`, a blue
  `#009ee2` swirl mark — distinct from the amber/sage web design tokens
  in `tailwind.config.js`, so don't assume it should match those).
  Wired into `frontend/index.html` via `<link rel="icon">`/
  `apple-touch-icon`. `npm run build` verified all four files land in
  `dist/`. Committed (`3d17c4c`) and live in production — visible on
  `https://dermarra.netlify.app`.

## Current Implementation Status (2026-09-18)

A three-way audit (backend, frontend, deployment/ops — each re-verified against
actual code and `git log`, not against this file's own claims) confirmed the full
current state of the system. This section is the authoritative, current picture;
where it conflicts with older dated sections above, trust this one. The system is
**live and functionally complete for a soft launch**, but **not yet safe to accept
real M-Pesa payments** — see "Not production-ready yet" below before flipping
`MPESA_ENV` to `production`.

### What's shipped and live

- **Auth**: signup, login, forgot-password/reset-password (single-use,
  time-limited `itsdangerous` token, not a JWT — see "Auth pages" above),
  change-password, profile + shipping-defaults editing
  (`PATCH /api/auth/me`). `backend/app/routes/auth.py`.
- **Catalog & taxonomy**: products, `SkinConcern`, `Ingredient`, `StepGroup`
  (fixed 4-row prep/treat/seal/protect set), all admin-manageable except
  `StepGroup` rows themselves (PATCH-only, no create/delete).
  `backend/app/routes/products.py`, `backend/app/models/product.py`.
- **Storefront browse pages**: `/shop/concern/:slug`, `/shop/ingredient/:slug`,
  `/shop/step/:key` (`ConcernShop.jsx`/`IngredientShop.jsx`/`StepShop.jsx`),
  with breadcrumbs.
- **Cart & Wishlist**: standard cart; wishlist mirrors cart's model shape
  (`Wishlist`/`WishlistItem`), one-click heart toggle on `ProductCard.jsx`.
- **Routine quiz + bundles**: `POST /api/routines/quiz` matches on concern
  and (optionally) skin type in three fallback tiers so it never refuses a
  match; `Routine.bundle_discount_percent` is the only discount mechanic in
  the app (see "Deferred" below).
- **Checkout + M-Pesa STK Push**: `backend/app/routes/payments.py`,
  `backend/app/services/mpesa_service.py`. Order state machine `pending` →
  `payment_pending` → `paid`/`payment_failed`. **`MPESA_ENV=sandbox`** in
  production today (hardcoded default in `render.yaml`, deliberately not
  `production`) — no real money has moved through this system yet.
- **Inventory (FEFO batch/lot tracking)**: `backend/app/services/inventory_service.py`.
  The best-tested subsystem in the project — `backend/tests/test_inventory.py`
  (8 tests: reservation concurrency via row locking, FEFO allocation +
  expired-batch exclusion, idempotent consumption, release, restock
  reversal) — all passing, though **not run in CI** (see gaps below).
- **Admin dashboard**: orders (delivery pipeline + proof-of-delivery photo),
  products, routines, inventory, taxonomy (concerns/ingredients/step-groups),
  hero slides, user role promotion — full UI, not API-only.
- **Transactional email**: 6 types (welcome, password reset, order
  confirmation, shipping update, invoice, newsletter contact-add) via
  `backend/app/services/brevo_service.py`, all HTML-escaped, sender domain
  (`dermarra.com`) verified with DKIM/DMARC.
- **Homepage/landing**: `HeroCarousel.jsx` (admin-managed via
  `GET /api/hero-slides`, also reused as `AuthPromoPanel.jsx` on the auth
  pages), `Footer.jsx` (newsletter signup wired to
  `POST /api/newsletter/subscribe`), account self-service pages under
  `/account/*` (`AccountProfile`/`AccountRoutines`/`AccountOrders`/
  `AccountOrderDetail`/`AccountWishlist`).
- **Responsive nav**: `Navbar.jsx` (desktop, `sm:flex`) +
  `BottomNav.jsx` (mobile, `sm:hidden`, 5-tab bar with live cart badge),
  both unconditional across every route including `/admin/*`.
- **Favicon**: real brand mark, SVG + ICO/PNG fallbacks, live.
- **Deployment**: `https://dermarra-backend.onrender.com` (Render, free
  tier, Python/gunicorn) + `https://dermarra.netlify.app` (Netlify,
  Vite build) + Supabase Postgres. Both connected directly to
  `dermarra/dermarra-app` via each platform's own dashboard (no CLI, no
  GitHub Actions deploy step). Database connectivity verified live via a
  real DB-backed endpoint, not just the static `/api/health` check.

### Not production-ready yet (found by the 2026-09-18 audit)

**Security — the most urgent gaps:**
- **`POST /api/payments/mpesa/callback` (`backend/app/routes/payments.py:75-123`)
  has zero request verification** — no signature, no shared secret, no IP
  allowlist. Anyone who obtains a valid `CheckoutRequestID` (trivially — start
  a real STK push for your own order, then skip paying) can POST a forged
  `ResultCode: 0` directly and get any order marked `paid` for free. Must fix
  before `MPESA_ENV` ever goes to `production` — see the "Path to Real
  Production" plan (Phase 1.1).
- **No rate limiting anywhere** — login, signup, forgot-password,
  change-password, and STK-push initiation are all unthrottled (brute-force
  and STK-push-spam risk).
- **No security headers** — no HSTS/CSP/X-Frame-Options/X-Content-Type-Options
  (no Flask-Talisman or manual equivalent).
- **No input-validation library** — every route does manual `.get()` +
  presence/length checks; no marshmallow/pydantic/WTForms schema layer.
- **No error tracking** (no Sentry or equivalent) and **no log persistence**
  beyond Render's ephemeral stdout stream — a production incident today would
  be debugged blind once Render's log retention window passes.

**Legal/compliance:**
- `frontend/src/pages/Privacy.jsx` and `Terms.jsx` are still literal
  10-line placeholder stubs ("replace this with Dermarra Skincare's actual
  privacy policy") on a live site that collects real names, addresses,
  phone numbers, and (once M-Pesa goes to production) payment activity.
- **No cookie-consent mechanism** anywhere in the frontend.

**Testing/CI:**
- `.github/workflows/ci.yml` only lints (`flake8` backend, `eslint`+
  `npm run build` frontend) — **`backend/tests/` is never run in CI**, only
  locally, and only covers inventory (nothing for auth, catalog, orders, or
  the M-Pesa callback specifically). `backend/tests/conftest.py` also
  requires a real Postgres connection (runs against the actual dev DB, no
  isolated test DB or SQLite fallback).
- No frontend tests of any kind.

**Frontend performance:**
- **Single ~993KB JS bundle** (288KB gzipped) — zero code-splitting
  (`React.lazy`/`Suspense`/dynamic `import()` used nowhere), so every
  anonymous shopper downloads the entire admin dashboard's dependencies
  (recharts, dnd-kit) along with the storefront.
- **No SEO basics**: static site-wide `<title>` (no per-page titles), no
  meta description/Open Graph/Twitter tags, no `robots.txt`, no
  `sitemap.xml`.
- **No error boundary** — an unhandled render error white-screens the
  entire app.
- **`npm audit`**: 2 moderate CVEs in `react-router`/`react-router-dom`
  (open-redirect + a deserialization issue), fixable with a targeted patch
  bump, not necessarily the full v7 major upgrade.
- Minor a11y gaps: `Navbar.jsx`'s cart icon-link has no `aria-label`;
  `Login`/`Signup`/`Checkout` inputs rely on placeholder text rather than a
  real visible `<label>`.

**Ops/data safety:**
- **No documented or verified database backup strategy** for the Supabase
  Postgres instance — not mentioned anywhere in any README.
- Root `README.md`'s migration runbook is **stale**: it tells readers to
  run `flask db upgrade` via Render's Shell tab, which **doesn't exist on
  the free plan actually in use** (`render.yaml` has `plan: free`) — the
  real workaround (documented in this file's "First live deploy" section
  above, not yet ported into `README.md` itself) is running the migration
  from a local machine against the production `DATABASE_URL`.
- Render free tier spins the backend down after inactivity — first request
  after idling can take 50+ seconds. Acceptable for a soft launch, a real
  UX/conversion risk once real customers show up; upgrading is a cost
  decision, not yet made.
- `dermarra.com` is verified and in use for **email only** — the website
  itself is still on `onrender.com`/`netlify.app` subdomains; wiring the
  custom domain to the site was explicitly deferred by the user for now.

### Deferred by deliberate product decision (not bugs, not forgotten)

- ~~Product variant/size model~~ — **shipped 2026-09-18**, see "ProductVariant"
  below. This item is stale; kept struck through rather than deleted so
  nobody re-reads an old copy of this file and thinks it's still open.
- **Coupon/discount-code system**: the only discount mechanic anywhere is
  `Routine.bundle_discount_percent`. The homepage's "Become a member"
  section is copy + a `/signup` link only — it applies no actual discount.
  Needs a choice between a hardcoded first-order discount vs. a real
  admin-editable `Coupon` model before wiring real money off checkout.

A full phased plan for closing the "not production-ready yet" gaps above,
in risk order, is maintained as a Claude Code plan file (not duplicated
here since plan files are session-specific) — ask Claude to regenerate it
from this section if it's not available.

## ProductVariant (2026-09-18)

Phase 1 of a larger next-build brief (coupons, brand naming/client areas, CI,
blog/reviews/search, card payments, hardening — all sequenced after this).
`Product` is now a catalogue "family" (name, description, images, concern/
ingredient tags); each sellable size/SKU is a `ProductVariant`, which owns
`price_cents`/`currency`/`sku` and is what stock is tracked against. This
unblocks the size-selector UI that had been explicitly deferred since the
landing-page work.

Two architecture questions surfaced during planning that the original brief
didn't address, both resolved with the user before writing any code:
- **`RoutineStep` pins to a specific `ProductVariant`**, not the `Product`
  family — a curated bundle names an exact size ("the 50ml serum"),
  deterministic pricing, no "default variant" concept needed.
- **`Wishlist` stays at the `Product` level, unchanged** — the heart-toggle
  on `ProductCard` has no size selector and doesn't need one; saving a
  product for later is inherently family-level.

### What changed

- **New model**: `ProductVariant` (`backend/app/models/product.py`) — `id`,
  `product_id`, `label` (free string, e.g. "30ml" — not everything sold is
  measured in ml), `sku` (unique), `price_cents`, `currency`, `is_active`,
  `position`.
- **Moved off `Product`, onto `ProductVariant`**: `price_cents`, `currency`.
  Stayed on `Product` (family-level): everything else, including `images`
  (shared gallery across variants) and concern/ingredient tags.
- **Moved from `product_id` → `variant_id`**: all four inventory tables
  (`Inventory`, `InventoryBatch`, `InventoryTransaction`,
  `InventoryReservation`), `CartItem`, `RoutineStep`. `OrderItem` gained
  `variant_id` **alongside** its existing `product_id` (kept denormalized
  on purpose — order history must keep reading correctly even if a variant
  is later deleted; `OrderItem` is already snapshot-priced via
  `name_snapshot`/`unit_price_cents_snapshot`, so no historical-price
  backfill was needed there). `WishlistItem` deliberately untouched.
- **Migration** (`fc2dafba970e_add_product_variants.py`): follows
  `a9322b7ec397`'s established style (raw `op`-level DDL, `sa.table()`
  shadow objects for the backfill, drop superseded columns in the same
  migration, a real tested `downgrade()`). Backfills exactly one
  `ProductVariant` per existing product (`label="Standard"`, carrying that
  product's old price), then re-points every dependent row at that default
  variant before dropping `product_id`/`price_cents`/`currency`. **Applied
  to the dev DB this session** — 5 products → 5 variants, all inventory/
  order/routine-step rows correctly backfilled, verified via direct query
  (see "Verified" below).
- **Deduplicated while touching this code**: `inventory_service.py` used to
  reimplement `utils/order_lines.py`'s order-line-expansion logic inline
  (found by this session's own audit). It now imports and calls
  `order_stock_lines()` instead — one implementation, not two.
- **`inventory_service.py`**: every function rewritten to key on
  `variant_id`. The deadlock-safety property (`_lock_inventories_for`
  locking in `sorted(set(...))` order before any `SELECT ... FOR UPDATE`)
  was specifically preserved, not just superficially resembled — reverified
  by rerunning the concurrency test after the rewrite (see "Verified").
- **Routes**: `GET /api/products` (list) now returns `price_from_cents`
  (min active-variant price), `in_stock` (any active variant in stock), and
  `default_variant_id` (cheapest in-stock variant — lets `ProductCard`'s
  one-click quick-add keep working without a size picker).
  `GET /api/products/<slug>` nests a full `variants` array.
  `POST /api/cart/items` takes `variant_id` instead of `product_id`. Admin
  gained `/admin/products/<id>/variants[/<id>]` CRUD (mirrors the existing
  `ProductImage` sub-resource pattern) and `/admin/inventory/<variant_id>/*`
  replaces the old product-keyed inventory endpoints.
  `PUT /admin/routines/<id>/steps` body changed from `product_id` to
  `variant_id` per step.
- **Frontend**: `ProductDetail.jsx` gained the size selector (pills, price/
  stock update per selection). `ProductCard.jsx` shows "From KES X" and
  quick-adds `default_variant_id`. New `frontend/src/lib/cartTotals.js`
  extracts the cart-total math that used to be copy-pasted across
  `Cart.jsx`/`Checkout.jsx` (plus a third inline copy in `Cart.jsx` for the
  routine strikethrough price) into one variant-aware implementation.
  `AdminProducts.jsx`'s single `price_kes` field and its separate inline-
  price-edit-in-table-cell flow are both gone, replaced by an inline
  variant editor (`VariantRow`, immediate per-row save/delete — deliberately
  *not* the "stage then bulk-save" pattern `AdminRoutines.jsx`'s Steps panel
  uses, since this file's own image gallery already established an
  immediate-per-op convention and consistency within the file won out).
  `AdminRoutines.jsx`'s step picker now lists "Product — Size" options.
  `AdminInventory.jsx`/`AdminInventoryDetail.jsx` updated for the variant-
  keyed endpoints (`:variantId` route param, `detail.variant` instead of
  `detail.product`). Confirmed **zero changes needed** in
  `RoutineStepRail.jsx` or any order-history view (`AccountOrderDetail.jsx`,
  admin order detail) — both already only read family-level `product.*`
  fields or the frozen `name_snapshot`/`unit_price_cents_snapshot`.

### Verified

`backend/tests/test_inventory.py`'s fixtures (`conftest.py`) rewritten to
create a `Product`+`ProductVariant` pair (`make_variant`, was
`make_product`) — all 8 tests pass, specifically including the concurrency
test that proves real row-locking still holds under the new `variant_id`
key. `flake8` clean. `npm run lint`/`npm run build` clean (build output
unchanged at ~997KB — this phase didn't touch the known bundle-size issue,
that's Phase 5).

Full API-level walkthrough against a temporary `flask run --port 5001`
(same convention as prior sessions — kept separate from the user's own dev
server): signup → add a real product's variant to cart → verify the nested
`{product, variant}` cart-item shape → checkout → confirmed
`name_snapshot` correctly bakes in the variant label ("Mineral SPF 50 —
Standard") and both `product_id`/`variant_id` land on the `OrderItem` →
confirmed the reservation actually held (`on_hand`/`reserved` via the admin
inventory-detail endpoint) → cancelled the order and confirmed the
reservation released. Separately created a two-variant test product (30ml/
50ml, different prices), received stock for only one size, and confirmed
`GET /api/products/<slug>` correctly reports family-level `in_stock: true`
(because *a* variant has stock) with `price_from_cents` picking the
cheaper size, while each variant's own `stock_status` stays independent.
All verification data (test product, test order/reservation, disposable
test user) cleaned up afterward — dev DB confirmed back to baseline (5
products/5 variants, 0 leftover test rows).

**Not done this session**: no in-browser click-through of the new frontend
(size selector, admin variant editor) — API-level and build/lint
verification only, consistent with prior sessions' own noted gaps when a
real browser wasn't used. `backend/README.md`/`frontend/README.md` don't
yet document the new `ProductVariant` endpoints/shapes.

**Deployment note for whoever ships this**: this migration has been applied
to the **dev** database only. The live Render backend is still running
against the pre-migration schema. Do **not** push this branch to
`dermarra/dermarra-app` and let Render auto-deploy without immediately
following up with `flask db upgrade` against the **production**
`DATABASE_URL` (session pooler, port 5432, temporarily) — deploying the new
code before running the migration will crash every request that touches
`Product`/`Inventory`/`Cart`/`Order`/`RoutineStep` on the live site, since
those tables/columns won't match what the new code expects. This should be
done as one supervised push-then-migrate sequence, not two separate
unsupervised steps.

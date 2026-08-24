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
production run — Derma Skincare manufactures in-house, so there's no
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

## Catalog Taxonomy, Account Self-Service & Storefront Rebrand (in progress, uncommitted)

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
  `46f80398af62`, `2a735e468547`) — not yet confirmed applied to the dev DB
  this session, check `flask db current` before assuming so.
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

### Not done yet
- Nothing has been committed.
- `backend/README.md` / `frontend/README.md` don't reflect any of the above
  (new endpoints, dropped `hair` step type, new models).
- No automated tests; no noted manual verification pass (backend curl or
  frontend click-through) for this batch — treat as unverified until run.

## Landing Page Expansion (in progress, uncommitted)

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

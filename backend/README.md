# Backend — Flask API

## Setup

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env`:
- `DATABASE_URL` — Supabase connection string (Project Settings → Database → Connection string)
- `JWT_SECRET_KEY` — any long random string (`python -c "import secrets; print(secrets.token_hex(32))"`)
- `CLOUDINARY_*` — from your Cloudinary dashboard
- `BREVO_API_KEY` — from Brevo → SMTP & API → API Keys
- `BREVO_NEWSLETTER_LIST_ID` — the numeric Brevo contact list ID the footer's
  newsletter form subscribes into (Brevo → Contacts → Lists). Without it,
  `POST /api/newsletter/subscribe` returns 503 rather than failing silently.
- `FRONTEND_BASE_URL` — the canonical frontend origin (default
  `http://localhost:5173`) used to build the link inside password-reset
  emails. Distinct from `FRONTEND_ORIGIN` below, which is the full CORS
  allowlist.
- `MPESA_*` — see the M-Pesa section below

## Database migrations

```bash
flask db init          # only once, creates migrations/
flask db migrate -m "initial schema"
flask db upgrade
```

Whenever you add/change a model in `app/models/`, run `flask db migrate -m "..."` then `flask db upgrade` again.

## Run

```bash
flask run
```

API is served at `http://localhost:5000`, all routes under `/api/*`. Health check: `GET /api/health`.

## API overview

| Endpoint                          | Method | Auth | Description |
|------------------------------------|--------|------|--------------|
| `/api/auth/signup`                | POST   | —    | Create account, returns JWT pair |
| `/api/auth/login`                 | POST   | —    | Returns JWT pair |
| `/api/auth/forgot-password`       | POST   | —    | `{email}` → emails a 30-min reset link if the account exists (same response either way) |
| `/api/auth/reset-password`        | POST   | —    | `{token, new_password}` → sets a new password; token is single-use (see `app/utils/tokens.py`) |
| `/api/auth/refresh`               | POST   | refresh token | New access token |
| `/api/auth/me`                    | GET    | access token | Current user |
| `/api/products`                   | GET    | —    | List products (filter by `step_type`, `concern`) |
| `/api/products/<slug>`            | GET    | —    | Product detail |
| `/api/products/concerns`          | GET    | —    | List skin concerns (for filters/quiz) |
| `/api/routines`                   | GET    | —    | List routine bundles |
| `/api/routines/<slug>`            | GET    | —    | Routine detail with ordered steps |
| `/api/routines/quiz`              | POST   | —    | `{concern_slug}` → recommended routine |
| `/api/hero-slides`                | GET    | —    | Active homepage hero slides, in position order |
| `/api/newsletter/subscribe`       | POST   | —    | `{email, full_name?}` → adds contact to the Brevo newsletter list |
| `/api/cart`                       | GET    | access token | Current user's cart |
| `/api/cart/items`                 | POST   | access token | Add product or routine to cart |
| `/api/cart/items/<id>`            | PATCH  | access token | Update quantity |
| `/api/cart/items/<id>`            | DELETE | access token | Remove item |
| `/api/wishlist`                   | GET    | access token | Current user's wishlist |
| `/api/wishlist/items`             | POST   | access token | `{product_id}` → save a product (no-op if already saved) |
| `/api/wishlist/items/<id>`        | DELETE | access token | Remove by wishlist item id |
| `/api/wishlist/items/by-product/<product_id>` | DELETE | access token | Remove by product id (for a toggle button) |
| `/api/orders`                     | GET    | access token | List past orders |
| `/api/orders/<id>`                | GET    | access token | Order detail |
| `/api/orders/checkout`            | POST   | access token | Create order from cart (status `pending`) |
| `/api/payments/mpesa/stk-push`    | POST   | access token | `{order_id, phone}` → sends STK push to customer's phone |
| `/api/payments/mpesa/status/<order_id>` | GET | access token | Poll after STK push for `paid` / `payment_failed` |
| `/api/payments/mpesa/callback`    | POST   | — (Safaricom only) | Webhook Daraja calls with the payment result |
| `/api/admin/products`             | GET/POST | admin | List/create products |
| `/api/admin/products/<id>`        | PATCH/DELETE | admin | Update/delete a product |
| `/api/admin/routines`             | GET/POST | admin | List/create routines |
| `/api/admin/routines/<id>`        | PATCH/DELETE | admin | Update/delete a routine |
| `/api/admin/routines/<id>/steps`  | PUT    | admin | Replace a routine's full ordered step list |
| `/api/admin/concerns`             | GET/POST/DELETE | admin | Manage skin concerns |
| `/api/admin/hero-slides`          | GET/POST | admin | List/create homepage hero slides |
| `/api/admin/hero-slides/<id>`     | PATCH/DELETE | admin | Update/delete a hero slide |
| `/api/admin/upload-image`         | POST   | admin | Multipart upload → Cloudinary, returns `public_id` (optional `folder` form field) |
| `/api/admin/inventory`            | GET    | admin | List all products with stock status (optional `?status=in_stock\|low_stock\|out_of_stock`) |
| `/api/admin/inventory/low-stock`  | GET    | admin | Active products that are low or out of stock |
| `/api/admin/inventory/expiring-soon` | GET | admin | Active batches expiring within `?days=` (default 30) |
| `/api/admin/inventory/<product_id>` | GET  | admin | Product's inventory detail: batches + last 100 transactions |
| `/api/admin/inventory/<product_id>/receive` | POST | admin | Log a finished production run → `{batch_number, quantity_produced, unit_cost_cents?, expiry_date?, produced_at?, notes?}` |
| `/api/admin/inventory/<product_id>/adjust`  | POST | admin | Manual correction against one batch → `{batch_id, type, quantity, reason}`; `type` is one of `DAMAGE`/`EXPIRY`/`LOSS`/`ADJUSTMENT`/`SAMPLE`/`PROMOTION`/`INTERNAL_USE` |
| `/api/admin/inventory/expire-reservations` | POST | admin | Releases stock reservations nobody paid for in time — see "Inventory management" below |
| `/api/admin/orders`               | GET    | admin | List all orders (optional `?status=`), includes `user_id`/`user_email` |
| `/api/admin/orders/<id>`          | GET    | admin | Order detail (admin view) |
| `/api/admin/orders/<id>/refresh-payment-status` | POST | admin | Query Safaricom's live status for a `payment_pending` order |
| `/api/admin/orders/<id>/advance`  | POST   | admin | `{status, delivery_proof_public_id?}` → advance one step through `paid → processing → shipped → delivered`; proof photo required for `delivered` |
| `/api/admin/orders/<id>/cancel`   | POST   | admin | Cancel a `paid`/`processing`/`shipped` order |
| `/api/admin/users`                | GET    | admin | List users with `created_at`/`order_count` |
| `/api/admin/users/<id>`           | PATCH  | admin | `{is_admin}` → promote/demote (can't demote yourself) |

Auth header for protected routes: `Authorization: Bearer <access_token>`.

## M-Pesa Daraja (STK Push) setup

1. Register at https://developer.safaricom.co.ke and create an app to get a sandbox `Consumer Key`/`Consumer Secret`.
2. For sandbox testing, use shortcode `174379` and the published sandbox passkey from Safaricom's docs.
3. Daraja calls back over the public internet, so `MPESA_CALLBACK_URL` cannot be `localhost`. For local dev, run `ngrok http 5000` and set `MPESA_CALLBACK_URL=https://<your-id>.ngrok-free.app/api/payments/mpesa/callback`.
4. Flow: `POST /api/orders/checkout` creates the order → `POST /api/payments/mpesa/stk-push` triggers the customer's phone prompt → Safaricom hits `/api/payments/mpesa/callback` with the result → frontend polls `/api/payments/mpesa/status/<order_id>` until it flips to `paid`.
5. Going live requires production credentials and a registered Paybill/Till number — sandbox only simulates payments.

## Admin access

The very first admin has to be bootstrapped via `flask shell` (there's no
signup flow for admins, and you can't call an admin endpoint before you're
one):

```python
from app.extensions import db
from app.models import User

user = User.query.filter_by(email="you@example.com").first()
user.is_admin = True
db.session.commit()
```

After that, any admin can promote or demote other users via
`PATCH /api/admin/users/<id>` (or the `/admin/users` page in the frontend)
with `{"is_admin": true|false}`. An admin cannot demote themselves through
this endpoint — drop back to `flask shell` if you ever need to.

## Inventory management

Derma Skincare manufactures in-house, so stock enters the system as
**production runs**, not purchase orders — there's no supplier/vendor
concept anywhere in this model. `Product.stock_quantity` no longer
exists; `app/models/inventory.py` (`Inventory`, `InventoryBatch`,
`InventoryTransaction`, `InventoryReservation`) is the sole source of
truth, and `app/services/inventory_service.py` is the only code that
should ever touch it — never write to those tables directly.

- **Batches & FEFO**: each production run is one `InventoryBatch`
  (`batch_number`, `quantity_produced`/`quantity_remaining`,
  `unit_cost_cents` — internal production cost per unit, `expiry_date` —
  nullable for non-expiring products, `produced_at`, `notes`). Selling
  against stock always draws from the earliest-expiring active batch
  first (non-expiring batches sort last, not excluded).
- **Reservations**: checkout places a hold (`InventoryReservation`,
  `Inventory.reserved`) rather than decrementing stock immediately, so
  `available = on_hand - reserved` can never go negative even under
  concurrent checkouts (enforced with `SELECT ... FOR UPDATE` on the
  `Inventory` row, not an app-level check-then-write). The hold is
  consumed (FEFO-allocated, ledgered as `SALE`) once M-Pesa confirms
  payment, or released if payment fails/is cancelled.
- **Expiring reservations**: there's no background worker in this
  project (no Celery/APScheduler). A reservation that nobody pays for
  within ~20 minutes is released lazily the next time anyone reserves
  stock, and `POST /api/admin/inventory/expire-reservations` is exposed
  for an external cron (or a manual hit) to sweep the rest — same
  "no automation exists yet, here's a manual/cron-friendly endpoint"
  pattern as this project already leans on elsewhere (e.g. ngrok for the
  M-Pesa callback in local dev).
- **Ledger**: `InventoryTransaction` is append-only — every unit that
  ever entered or left a batch (`PRODUCTION_RECEIPT`, `SALE`, `RETURN`,
  `DAMAGE`, `EXPIRY`, `LOSS`, `ADJUSTMENT`, `SAMPLE`, `PROMOTION`,
  `INTERNAL_USE`) is one row, never edited afterward. A mistake gets a
  correcting transaction, not a rewrite. Because of this, a product with
  any inventory history can't be deleted via `DELETE /api/admin/products/
  <id>` (400) — set `is_active: false` instead.
- **Customer-facing**: `Product.to_dict()` exposes `stock_status`
  (`in_stock`/`low_stock`/`out_of_stock`) and `in_stock` (bool) only —
  batch numbers, unit cost, and the transaction ledger are admin-only
  fields, gated behind `include_admin_fields=True`.

## Seeding sample data

```python
from app.extensions import db
from app.models import SkinConcern, Product, Routine, RoutineStep
from app.services import inventory_service

hyperpig = SkinConcern(name="Hyperpigmentation", slug="hyperpigmentation")
db.session.add(hyperpig)
db.session.commit()

cleanser = Product(name="Gentle Gel Cleanser", slug="gentle-gel-cleanser",
                    step_type="cleanser", price_cents=180000)
serum = Product(name="Ascorbic Acid Serum", slug="ascorbic-acid-serum",
                 step_type="serum", key_actives="10% Ascorbic Acid",
                 price_cents=320000, skin_concerns=[hyperpig])
cream = Product(name="Barrier Repair Cream", slug="barrier-repair-cream",
                 step_type="barrier_cream", price_cents=280000)
spf = Product(name="Mineral SPF 50", slug="mineral-spf-50",
              step_type="spf", price_cents=240000)
db.session.add_all([cleanser, serum, cream, spf])
db.session.commit()

# Stock only exists once a production run is logged against it -- there's
# no stock_quantity field on Product anymore (see "Inventory management").
for product in [cleanser, serum, cream, spf]:
    inventory_service.record_production_run(
        product.id, batch_number="SEED-1", quantity_produced=100,
    )
db.session.commit()

routine = Routine(name="Brightening Routine", slug="brightening-routine",
                   tagline="Even tone, fade hyperpigmentation",
                   primary_concern_id=hyperpig.id, bundle_discount_percent=10)
db.session.add(routine)
db.session.commit()

steps = [
    RoutineStep(routine_id=routine.id, product_id=cleanser.id, order_index=1, time_of_day="both"),
    RoutineStep(routine_id=routine.id, product_id=serum.id, order_index=2, time_of_day="both"),
    RoutineStep(routine_id=routine.id, product_id=cream.id, order_index=3, time_of_day="both"),
    RoutineStep(routine_id=routine.id, product_id=spf.id, order_index=4, time_of_day="am"),
]
db.session.add_all(steps)
db.session.commit()
```

`price_cents` is stored in cents, so 180000 = KES 1,800. Replace this with a proper seed script or the admin API once you're past prototyping.

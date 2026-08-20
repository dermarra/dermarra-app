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
| `/api/auth/refresh`               | POST   | refresh token | New access token |
| `/api/auth/me`                    | GET    | access token | Current user |
| `/api/products`                   | GET    | —    | List products (filter by `step_type`, `concern`) |
| `/api/products/<slug>`            | GET    | —    | Product detail |
| `/api/products/concerns`          | GET    | —    | List skin concerns (for filters/quiz) |
| `/api/routines`                   | GET    | —    | List routine bundles |
| `/api/routines/<slug>`            | GET    | —    | Routine detail with ordered steps |
| `/api/routines/quiz`              | POST   | —    | `{concern_slug}` → recommended routine |
| `/api/cart`                       | GET    | access token | Current user's cart |
| `/api/cart/items`                 | POST   | access token | Add product or routine to cart |
| `/api/cart/items/<id>`            | PATCH  | access token | Update quantity |
| `/api/cart/items/<id>`            | DELETE | access token | Remove item |
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
| `/api/admin/upload-image`         | POST   | admin | Multipart upload → Cloudinary, returns `public_id` (optional `folder` form field) |
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

## Seeding sample data

```python
from app.extensions import db
from app.models import SkinConcern, Product, Routine, RoutineStep

hyperpig = SkinConcern(name="Hyperpigmentation", slug="hyperpigmentation")
db.session.add(hyperpig)
db.session.commit()

cleanser = Product(name="Gentle Gel Cleanser", slug="gentle-gel-cleanser",
                    step_type="cleanser", price_cents=180000, stock_quantity=100)
serum = Product(name="Ascorbic Acid Serum", slug="ascorbic-acid-serum",
                 step_type="serum", key_actives="10% Ascorbic Acid",
                 price_cents=320000, stock_quantity=100, skin_concerns=[hyperpig])
cream = Product(name="Barrier Repair Cream", slug="barrier-repair-cream",
                 step_type="barrier_cream", price_cents=280000, stock_quantity=100)
spf = Product(name="Mineral SPF 50", slug="mineral-spf-50",
              step_type="spf", price_cents=240000, stock_quantity=100)
db.session.add_all([cleanser, serum, cream, spf])
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

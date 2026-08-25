# Frontend — React + Tailwind

Mobile-first e-commerce UI for Dermarra Skincare. Built with Vite, React Router, and Tailwind CSS.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
- `VITE_API_URL` — your Flask API base URL (`http://localhost:5000/api` locally; the deployed Render backend's URL + `/api` in production)
- `VITE_CLOUDINARY_CLOUD_NAME` — from your Cloudinary dashboard (builds responsive image URLs client-side, no extra API call)

Vite bakes these into the build at build time — changing either one requires a rebuild, not just a restart. See the root `README.md`'s "Deployment" section for the Netlify setup.

## Run

```bash
npm run dev
```

App runs at `http://localhost:5173`.

## Structure

```
src/
├── api/client.js            # axios instance, JWT refresh interceptor, Cloudinary URL helper
├── context/                  # AuthContext, CartContext, WishlistContext — server-synced state
├── components/                # shared UI: Navbar, BottomNav, Footer, ProductCard,
│                               # RoutineStepRail, HeroCarousel, AuthPromoPanel, Breadcrumbs,
│                               # ImageUploadField (Cloudinary + optional crop step), Icons, Reveal
└── pages/
    ├── Home.jsx, Shop.jsx, ProductDetail.jsx
    ├── ConcernShop.jsx / IngredientShop.jsx / StepShop.jsx   # shop-by-facet pages
    ├── RoutineQuiz.jsx, Cart.jsx, Checkout.jsx
    ├── Login.jsx / Signup.jsx / ForgotPassword.jsx / ResetPassword.jsx
    ├── account/               # AccountLayout + Profile/Routines/Wishlist/Orders tabs
    └── admin/                 # AdminLayout + Dashboard/Products/Inventory/Routines/
                                # Concerns/Ingredients/StepGroups/HeroSlides/Orders/Users
```

## Design tokens

Defined in `tailwind.config.js`:

| Token | Hex | Use |
|---|---|---|
| `bone` | `#FFFFFF` / `#F7F7F6` | Background |
| `ink` | `#64615A` | Body text |
| `sage` | `#84C665` | Brand/barrier-biology accent |
| `amber` | `#F47A53` | Primary CTA |
| `sky` | `#00C0F3` | Tertiary accent (decorative gradients, charts) |
| `clay` | `#B75C3E` (same as `amber-dark`) | Errors, destructive actions, concern tags |
| `mist` | `#ECECEB` | Borders/dividers |

Fonts: **Fraunces** (display headings), **Public Sans** (body), **IBM Plex Mono** (ingredient actives/concentrations, step numbers — reinforces "clinical precision").

## Checkout flow

1. `/cart` → "Checkout" → `/checkout`
2. Customer fills shipping details (prefilled from their saved default, if any) + M-Pesa phone number
3. `POST /api/orders/checkout` creates the order (status `pending`) and reserves stock against it
4. `POST /api/payments/mpesa/stk-push` triggers Safaricom's payment prompt on the customer's phone
5. Frontend polls `GET /api/payments/mpesa/status/<order_id>` every 3s until Safaricom's webhook (handled server-side) flips the order to `paid` (consuming the reservation, FEFO-allocated) or `payment_failed` (releasing it)

## What's next to build

See the root `README.md`'s "Status" section for the full picture — the two open items that touch this app specifically are a product size/variant selector (no such model exists yet) and a real coupon/discount mechanism behind the homepage's "become a member" CTA.

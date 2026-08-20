# Frontend — React + Tailwind

Mobile-first e-commerce UI for Derma Skincare. Built with Vite, React Router, and Tailwind CSS.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
- `VITE_API_URL` — your Flask API base URL (e.g. `http://localhost:5000/api` locally)
- `VITE_CLOUDINARY_CLOUD_NAME` — from your Cloudinary dashboard (builds responsive image URLs client-side, no extra API call)

## Run

```bash
npm run dev
```

App runs at `http://localhost:5173`.

## Structure

```
src/
├── api/client.js           # axios instance, JWT refresh interceptor, Cloudinary URL helper
├── context/
│   ├── AuthContext.jsx     # signup/login/logout, persisted session
│   └── CartContext.jsx     # server-synced cart state
├── components/
│   ├── Navbar.jsx          # desktop nav + mobile cart shortcut
│   ├── BottomNav.jsx       # mobile bottom tab bar (Home/Shop/Quiz/Cart/Account)
│   ├── ProductCard.jsx
│   └── RoutineStepRail.jsx # signature component: shows ordered routine steps
└── pages/
    ├── Home.jsx
    ├── Shop.jsx             # product grid, filterable by step type
    ├── ProductDetail.jsx    # sticky mobile add-to-cart bar
    ├── RoutineQuiz.jsx      # concern picker -> recommended routine
    ├── Cart.jsx
    ├── Checkout.jsx         # shipping form + M-Pesa STK push + payment polling
    ├── Login.jsx / Signup.jsx
    └── Account.jsx          # profile + order history
```

## Design tokens

Defined in `tailwind.config.js`:

| Token | Hex | Use |
|---|---|---|
| `bone` | `#EDEAE2` / `#F6F4EE` | Background |
| `ink` | `#1F2A24` | Body text |
| `sage` | `#5C6F5D` | Brand/barrier-biology accent |
| `amber` | `#B5702C` | Primary CTA — matches the actual amber dropper-bottle packaging |
| `clay` | `#A8574E` | Secondary accent for concern tags (acne, redness), errors |
| `mist` | `#D8D2C4` | Borders/dividers |

Fonts: **Fraunces** (display headings), **Public Sans** (body), **IBM Plex Mono** (ingredient actives/concentrations, step numbers — reinforces "clinical precision").

## Checkout flow

1. `/cart` → "Checkout" → `/checkout`
2. Customer fills shipping details + M-Pesa phone number
3. `POST /api/orders/checkout` creates the order (status `pending`)
4. `POST /api/payments/mpesa/stk-push` triggers Safaricom's payment prompt on the customer's phone
5. Frontend polls `GET /api/payments/mpesa/status/<order_id>` every 3s until Safaricom's webhook (handled server-side) flips the order to `paid` or `payment_failed`

## What's next to build

- Admin frontend (product/routine management UI) — the backend API for this already exists at `/api/admin/*`, see `backend/README.md`
- Loading/empty/error state polish across pages
- Product image galleries (multiple Cloudinary images per product)
- Reviews/ratings if desired later

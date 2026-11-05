# Dermarra Skincare — E-commerce Web App

Barrier-first, science-led skincare, sold as **routines** (Cleanser → Serum → Barrier Cream → SPF), not just standalone products.

## Stack

| Layer      | Tech                                  |
|------------|----------------------------------------|
| Backend    | Flask (app factory), SQLAlchemy, Flask-JWT-Extended |
| Database   | PostgreSQL (hosted on Supabase)        |
| Frontend   | React (Vite) + Tailwind CSS            |
| Images     | Cloudinary                             |
| Email      | Brevo (transactional)                  |
| Payments   | M-Pesa Daraja (Lipa Na M-Pesa Online / STK Push) |

## Repo layout

```
derma-skincare/
├── backend/     # Flask API — see backend/README.md
├── frontend/    # React + Tailwind — see frontend/README.md
└── .github/workflows/ci.yml
```

## Get it running on WSL: Ubuntu + VS Code

**1. Unzip inside your WSL filesystem** (not `/mnt/c/...` — native paths like `~/projects/` are noticeably faster for pip/npm):

```bash
cd ~/projects
unzip derma-skincare-scaffold.zip
cd derma-skincare
code .
```

`code .` opens the folder with VS Code's WSL extension — check the bottom-left corner says "WSL: Ubuntu". Use VS Code's integrated terminal for everything below; it defaults to your WSL bash shell.

**2. Supabase (database only)**

1. Create a project at https://supabase.com.
2. Project Settings → Database → Connection string → copy the **Transaction pooler** URI (port 6543) — this is what `flask run` should use day to day. Session mode (port 5432) hard-caps at 15 connections project-wide and is only for running `flask db migrate`/`flask db upgrade` (switch back to the transaction pooler afterward).
3. Paste it into `backend/.env` as `DATABASE_URL` once you get there below.

We're not using Supabase Auth — auth is custom JWT issued by Flask. Supabase here is just managed Postgres.

**3. Backend**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

In VS Code: `Ctrl+Shift+P` → "Python: Select Interpreter" → pick `./backend/venv/bin/python` so linting/autocomplete work.

```bash
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and fill in `DATABASE_URL` and `JWT_SECRET_KEY` at minimum. Leave Cloudinary/Brevo/M-Pesa blank if you just want it running — those routes fail gracefully without keys.

```bash
flask db init
flask db migrate -m "initial schema"
flask db upgrade
flask run
```

Check `http://localhost:5000/api/health` → `{"status": "ok"}`. Full details, API reference, M-Pesa setup, and admin access in `backend/README.md`.

**4. Frontend**

Open a second terminal (keep the backend running):

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm run dev
```

Visit `http://localhost:5173`. Details in `frontend/README.md`.

## Git workflow

```bash
git init
git add .
git commit -m "Initial project scaffold"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

Suggested branching: `main` (deployable) ← `develop` ← feature branches (`feat/routine-quiz`, `feat/checkout`, etc.). A CI workflow at `.github/workflows/ci.yml` lints and build-checks both apps on push/PR.

## Status

1. ✅ Auth (signup/login/forgot-password/reset-password) + catalog taxonomy (concern/step/ingredient)
2. ✅ Cart, wishlist + order creation
3. ✅ Routine quiz (concern + skin type) + routine bundles
4. ✅ M-Pesa checkout (STK Push) with real batch/lot inventory (FEFO allocation, stock reservations — see `backend/README.md`'s "Inventory management")
5. ✅ Admin dashboard: orders, products, routines, inventory, taxonomy, users, hero slides — full UI, not just the API
6. ✅ Transactional email (welcome, password reset, order confirmation, shipping update, invoice, newsletter signup) — see `backend/README.md`'s "Transactional emails"
7. ✅ Product sizes (`ProductVariant`: each size has its own SKU, price and stock)
8. ✅ Coupons (percent / fixed, first-order-only, max uses, expiry) with an Admin → Coupons page
9. Automated CI test coverage for the backend (flake8 lints today; `backend/tests/` exists and passes locally but isn't wired into `.github/workflows/ci.yml` yet — needs either an ephemeral Postgres service container or a dedicated test-database secret, since the suite currently runs against the real dev DB by design)

## Deployment

Backend on [Render](https://render.com), frontend moving from [Netlify](https://netlify.com) to [Cloudflare Pages](https://pages.cloudflare.com) — this is a monorepo, so each platform builds from a subdirectory rather than the repo root. (Longer term the plan is a single OVHcloud VPS running Docker Compose; see `CLAUDE.md`.)

### Backend → Render

`render.yaml` at the repo root is a [Blueprint](https://render.com/docs/blueprint-spec) — Render → New → Blueprint, point it at this repo, and it reads that file directly rather than needing manual service setup. It declares the web service (`rootDir: backend`, `gunicorn wsgi:app` as the start command, `/api/health` as the health check) and every environment variable the app needs, marked `sync: false` so Render prompts you for the actual values in its dashboard instead of them ever being committed.

1. Fill in every `sync: false` variable in Render's dashboard — same names as `backend/.env`, see `backend/.env.example` and `backend/README.md` for what each one is.
2. **Migrations aren't automated** — `render.yaml` doesn't run `flask db upgrade` on deploy. The service is on Render's **free plan, which has no Shell tab**, so run migrations from your own machine against the session pooler (port 5432), overriding `DATABASE_URL` for that one command only:
   ```bash
   cd backend && source dermarra-venv/bin/activate
   DATABASE_URL="postgresql://…@…pooler.supabase.com:5432/postgres" flask db upgrade
   ```
   Dev and the live site share **one** Supabase database, so this changes the live schema immediately — keep migrations additive where possible and push the matching code right after.
3. `FRONTEND_ORIGIN` must list every frontend URL that calls the API (comma-separated, no spaces or line breaks) — see the Cloudflare Pages steps below. Render redeploys automatically when you save an env var change.
4. `MPESA_CALLBACK_URL` must point at the Render service's real public URL (`https://<your-service>.onrender.com/api/payments/mpesa/callback`), not an ngrok tunnel — ngrok is a local-dev-only tool (see `backend/README.md`'s M-Pesa section).
5. `render.yaml` defaults `MPESA_ENV` to `sandbox` so a fresh deploy never silently hits production Safaricom endpoints it isn't authorized for. Switch it to `production` in Render's dashboard only once you have real Daraja credentials and a registered Paybill/Till.

### Frontend → Cloudflare Pages

Nothing Cloudflare-specific is needed in the repo beyond `frontend/.nvmrc` (Node 20) and `frontend/public/_headers` (security + asset-cache headers). Pages serves `index.html` for every unknown path automatically because the build has no `404.html`, so React Router's client-side routes work on refresh without a redirect rule.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, pick `dermarra/dermarra-app`, production branch `main`.
2. Build settings:
   - Framework preset: **React (Vite)** (or none)
   - **Root directory: `frontend`**
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Environment variables (Production *and* Preview):
   - `VITE_API_URL` = `https://dermarra-backend.onrender.com/api`
   - `VITE_CLOUDINARY_CLOUD_NAME` = same cloud name as the backend
   - optional: `VITE_INSTAGRAM_URL`, `VITE_FACEBOOK_URL`, `VITE_TIKTOK_URL` (footer icons stay hidden until set)

   Vite bakes these in **at build time** — after changing one, retry the deployment.
4. On Render, update the backend env vars, then save (Render redeploys):
   - `FRONTEND_ORIGIN` — add the Pages URL, and a pattern for preview deployments (each preview gets a random subdomain):
     `https://dermarra.netlify.app,https://dermarra.pages.dev,https://[a-z0-9-]+\.dermarra\.pages\.dev`
     (use your actual Pages project subdomain; regex entries are anchored automatically, so a lookalike like `x.dermarra.pages.dev.attacker.com` is rejected)
   - `FRONTEND_BASE_URL` = the Pages URL (used to build password-reset links in emails)
5. Test on the Pages URL (sign in, add to cart, checkout). Once it's good, remove the Netlify site and its entry from `FRONTEND_ORIGIN`. `netlify.toml` can be deleted then too.
6. Later, a custom domain (`dermarra.com`): Pages project → Custom domains. Add it to `FRONTEND_ORIGIN` and set `FRONTEND_BASE_URL` to it.

### Post-deploy checklist

- `GET https://<render-service>.onrender.com/api/health` → `{"status": "ok"}`
- Visit the frontend URL, sign up, confirm the welcome email arrives (see `backend/README.md`'s sender-domain verification note — a real deploy needs `dermarra.com` verified in Brevo, not just the API key working)
- Run a full sandbox M-Pesa checkout end to end (`backend/README.md`'s M-Pesa section) before switching `MPESA_ENV` to `production`
- Log in as the bootstrapped first admin (`flask shell`, see `backend/README.md`'s "Admin access") and confirm `/admin/dashboard` loads real data

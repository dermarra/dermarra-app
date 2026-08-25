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
7. Product size/variant selector (no `ProductVariant` model exists yet — deferred, see `CLAUDE.md`)
8. A coupon/discount-code mechanism (the homepage's "become a member" CTA doesn't apply an actual discount yet — deferred, see `CLAUDE.md`)
9. Automated CI test coverage for the backend (flake8 lints today; `backend/tests/` exists and passes locally but isn't wired into `.github/workflows/ci.yml` yet — needs either an ephemeral Postgres service container or a dedicated test-database secret, since the suite currently runs against the real dev DB by design)

## Deployment

Backend on [Render](https://render.com), frontend on [Netlify](https://netlify.com) — this is a monorepo, so both platforms are configured to build from a subdirectory rather than the repo root.

### Backend → Render

`render.yaml` at the repo root is a [Blueprint](https://render.com/docs/blueprint-spec) — Render → New → Blueprint, point it at this repo, and it reads that file directly rather than needing manual service setup. It declares the web service (`rootDir: backend`, `gunicorn wsgi:app` as the start command, `/api/health` as the health check) and every environment variable the app needs, marked `sync: false` so Render prompts you for the actual values in its dashboard instead of them ever being committed.

1. Fill in every `sync: false` variable in Render's dashboard — same names as `backend/.env`, see `backend/.env.example` and `backend/README.md` for what each one is.
2. **Migrations aren't automated** — `render.yaml` doesn't run `flask db upgrade` on deploy, matching this project's existing manual-migration workflow (see the connection-pooling gotcha below). After the first deploy, open Render's Shell tab for the service and run:
   ```bash
   flask db upgrade
   ```
   Do this once after every deploy that adds a migration. Render's Shell reuses the same `DATABASE_URL` as the running service, which should be the **transaction pooler** (port 6543) — if a migration ever needs the session pooler (port 5432) instead (see `backend/README.md`'s gotcha #1), override `DATABASE_URL` for that one Shell command rather than changing the service's env var.
3. `FRONTEND_ORIGIN` must include the real Netlify URL once you have it (step below) — Render redeploys automatically when you save an env var change.
4. `MPESA_CALLBACK_URL` must point at the Render service's real public URL (`https://<your-service>.onrender.com/api/payments/mpesa/callback`), not an ngrok tunnel — ngrok is a local-dev-only tool (see `backend/README.md`'s M-Pesa section).
5. `render.yaml` defaults `MPESA_ENV` to `sandbox` so a fresh deploy never silently hits production Safaricom endpoints it isn't authorized for. Switch it to `production` in Render's dashboard only once you have real Daraja credentials and a registered Paybill/Till.

### Frontend → Netlify

`netlify.toml` at the repo root sets `base = "frontend"`, the build command, and the publish directory, plus the SPA fallback redirect React Router needs (without it, refreshing any non-root route 404s).

1. Netlify → Add new site → Import from Git, point at this repo. It should pick up `netlify.toml` automatically; if Netlify's UI asks for a base directory anyway, set it to `frontend`.
2. Site settings → Environment variables, set:
   - `VITE_API_URL` → your Render backend's public URL + `/api` (e.g. `https://dermarra-backend.onrender.com/api`)
   - `VITE_CLOUDINARY_CLOUD_NAME` → same Cloudinary cloud name as the backend

   Vite bakes these into the build at build time, not runtime — changing them requires a redeploy (Netlify → Deploys → Trigger deploy), not just a restart.
3. Once you have the real Netlify URL, go back and add it to Render's `FRONTEND_ORIGIN`.

### Post-deploy checklist

- `GET https://<render-service>.onrender.com/api/health` → `{"status": "ok"}`
- Visit the Netlify URL, sign up, confirm the welcome email arrives (see `backend/README.md`'s sender-domain verification note — a real deploy needs `dermarra.com` verified in Brevo, not just the API key working)
- Run a full sandbox M-Pesa checkout end to end (`backend/README.md`'s M-Pesa section) before switching `MPESA_ENV` to `production`
- Log in as the bootstrapped first admin (`flask shell`, see `backend/README.md`'s "Admin access") and confirm `/admin/dashboard` loads real data

# Derma Skincare — E-commerce Web App

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
2. Project Settings → Database → Connection string → copy the **Session pooler** URI (port 6543).
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

## Build order (recommended)

1. ✅ Auth (signup/login) + product catalog
2. ✅ Cart + order creation
3. ✅ Routine quiz + routine bundles
4. ✅ M-Pesa checkout (STK Push)
5. ✅ Admin API for managing products/routines (backend only — see `backend/README.md`)
6. Brevo email triggers beyond order confirmation (abandoned cart, etc.)
7. Admin frontend UI (the API exists; the screens don't yet)
8. Product image galleries, reviews, polish

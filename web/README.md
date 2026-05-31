# Liquor Store Inventory

Web-based inventory management system for tracking beer, wine, and spirits stock. Built with Next.js + Tailwind CSS on the frontend and FastAPI + Supabase (PostgreSQL) on the backend.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Backend | Python 3.12 + FastAPI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |

---

## Project Structure

```
Inventory/
├── web/          # Next.js frontend (this directory)
└── backend/      # FastAPI backend
```

---

## Getting Started

### 1. Backend

```bash
cd backend
source .venv/Scripts/activate    # Windows Git Bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Backend runs at **http://localhost:8001**

### 2. Frontend

```bash
cd web
npm install
npm run dev
```

App runs at **http://localhost:3000**

### 3. Environment variables

Create `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

## Features

- **Login** — Supabase email + password auth, session persists across reloads
- **Inventory list** — search by name/SKU, filter by category (beer / wine / spirits / non-alcoholic)
- **Stock adjustments** — +/- buttons open a modal to enter cases, packs, and singles; delta is recorded in the ledger
- **Add product** — form with category, container type, and initial stock; units/case and units/pack auto-fill from container type
- **Transaction history** — per-item audit trail with total units in/out summary

---

## Core Rules (never break)

1. **Base units** — the database always stores current_units as individual cans/bottles. Cases/packs/singles are computed at display time only.
2. **Delta ledger** — stock is never SET directly. Every change is an INSERT of a signed delta + UPDATE of current_units += delta. client_uuid provides idempotency.
3. **Always online** — the web app talks directly to the FastAPI backend; no local offline cache.

---

## API Endpoints (port 8001)

| Method | Path | Description |
|---|---|---|
| GET | /inventory/ | List all items |
| POST | /inventory/ | Create new item |
| GET | /inventory/{id}/history | Transaction history for an item |
| GET | /inventory/{id}/display-stock | Stock broken down into cases/packs/singles |
| POST | /sync/push | Push a batch of delta transactions |
| GET | /sync/pull | Pull items updated since a timestamp |
| GET | /health | Health check |

---

## Running Tests (backend)

```bash
cd backend
pytest -v   # 25 tests
```

---

## Roadmap

- [ ] RBAC (manager vs clerk roles)
- [ ] Reports + CSV export
- [ ] Barcode scanner
- [ ] Low-stock alerts
- [ ] Deploy frontend to Vercel, backend to Railway/Render
- [ ] RLS per store/org (Phase 2)

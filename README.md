# Liquor Store Inventory System

Full-stack inventory management for a liquor store. Web-based frontend (Next.js), Python API backend (FastAPI), and Supabase (PostgreSQL) as the database and auth provider.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Three Rules That Must Never Break](#three-rules-that-must-never-break)
4. [Directory Structure](#directory-structure)
5. [Supabase Setup](#supabase-setup)
6. [Backend Setup](#backend-setup)
7. [Web Frontend Setup](#web-frontend-setup)
8. [Running the Project](#running-the-project)
9. [API Endpoints](#api-endpoints)
10. [App Features](#app-features)
11. [Unit Conversion Logic](#unit-conversion-logic)
12. [Sync Engine](#sync-engine)
13. [Database Schema](#database-schema)
14. [Environment Variables](#environment-variables)
15. [Development Commands](#development-commands)
16. [Adding New Products](#adding-new-products)
17. [Troubleshooting](#troubleshooting)
18. [Roadmap](#roadmap)

---

## Architecture Overview

```
+--------------------------------------------------------+
|             Web Browser (Next.js 15)                   |
|  TypeScript + Tailwind CSS + Supabase JS client        |
|                                                        |
|  /login          /inventory        /inventory/add      |
|  Supabase Auth   Search/Filter     Product form        |
|                  +/- Stock modal                       |
|                  History link      /inventory/[id]/    |
|                                    history             |
|                      | HTTP fetch (port 8001)          |
+----------------------|---------------------------------+
                       |
            +----------v----------+
            |   FastAPI Backend   |
            |   Python 3.12       |
            |                     |
            |  base_unit_math.py  |  <- unit conversion (25 tests)
            |  sync_engine.py     |  <- delta ledger + idempotency
            +----------+----------+
                       | supabase-py
            +----------v----------+
            |      Supabase       |
            |  PostgreSQL + Auth  |
            |                     |
            |  inventory_items    |
            |  inventory_trans.   |
            |  locations          |
            +---------------------+
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Database | Supabase (PostgreSQL) | Auth, Row Level Security, realtime built in |
| Backend | Python 3.12 + FastAPI | Typed, async, runs on port 8001 |
| Python env | uv + `.venv` | System Python is 3.14 -- incompatible with pydantic-core. Always use the venv. |
| Frontend | Next.js 15 (App Router) + Tailwind CSS | Runs in browser on port 3000 |
| Auth | Supabase JS client | Email + password, session stored in browser |
| Testing | pytest | 25 unit tests on `base_unit_math.py` |

---

## Three Rules That Must Never Break

Violating any of these causes data loss or incorrect stock counts.

### Rule 1 -- Base units only in the database

**`current_units` is always individual cans or bottles. Never cases, never packs.**

```
Wrong:  current_units = 2       <- 2 of what? Cases? Packs?
Right:  current_units = 48      <- 48 individual cans (= 2 cases of 24)
```

Display conversion runs at render time in two places:
- Backend: `backend/app/services/base_unit_math.py` -> `to_display()`
- Frontend: `web/lib/stock.ts` -> `toDisplay()` / `displayStr()`

```python
to_display(33, units_per_case=24, units_per_pack=6)
# -> StockDisplay(cases=1, packs=1, singles=3, total_units=33)
# -> "1 case, 1 pack, 3 singles"
```

### Rule 2 -- Delta ledger, never SET

**Never overwrite `current_units` directly. Always insert a signed delta.**

```sql
-- Wrong
UPDATE inventory_items SET current_units = 47 WHERE id = ...;

-- Right
INSERT INTO inventory_transactions (item_id, delta_units, client_uuid, ...) VALUES (...);
UPDATE inventory_items SET current_units = current_units + 24 WHERE id = ...;
```

The `client_uuid` on every transaction is the idempotency key -- the same operation submitted twice is only applied once.

### Rule 3 -- Never go below zero

**The sync engine rejects any delta that would make `current_units` negative.**

`validate_delta(current_units=5, delta=-6)` raises `ValueError` before anything is written. The web frontend also validates client-side in `web/lib/stock.ts` before sending to the API.

---

## Directory Structure

```
Inventory/
+-- README.md
+-- backend/
|   +-- .venv/                             <- Python 3.12 -- DO NOT use system Python (3.14)
|   +-- app/
|   |   +-- main.py                        <- FastAPI app, CORS, router registration
|   |   +-- config.py                      <- pydantic-settings reads .env
|   |   +-- database.py                    <- Supabase client singleton
|   |   +-- models/
|   |   |   +-- schemas.py                 <- Pydantic models: InventoryItemCreate, TransactionIn, etc.
|   |   +-- routers/
|   |   |   +-- inventory.py               <- CRUD endpoints + display-stock
|   |   |   +-- sync.py                    <- POST /sync/push, GET /sync/pull
|   |   +-- services/
|   |       +-- base_unit_math.py          <- Unit conversion (THE critical file -- 25 tests)
|   |       +-- sync_engine.py             <- Delta ledger processor with idempotency
|   +-- tests/
|   |   +-- test_base_unit_math.py         <- 25 passing unit tests
|   +-- requirements.txt
|   +-- pytest.ini
|   +-- .env                               <- NOT committed -- Supabase URL + keys
+-- web/
|   +-- app/
|   |   +-- layout.tsx                     <- Root layout, AuthProvider wrapper
|   |   +-- page.tsx                       <- Redirects to /inventory or /login
|   |   +-- login/page.tsx                 <- Email + password login
|   |   +-- inventory/page.tsx             <- Inventory list, search, filter, stock modal
|   |   +-- inventory/add/page.tsx         <- Add new product form
|   |   +-- inventory/[id]/history/page.tsx <- Per-item transaction history
|   +-- components/
|   |   +-- AuthProvider.tsx               <- Supabase session context
|   |   +-- StockModal.tsx                 <- Cases/packs/singles adjustment modal
|   +-- lib/
|   |   +-- supabase.ts                    <- Supabase JS client (anon key)
|   |   +-- api.ts                         <- Typed fetch wrappers for FastAPI
|   |   +-- stock.ts                       <- Client-side unit conversion
|   +-- .env.local                         <- NOT committed -- Supabase + API URL
|   +-- package.json
+-- supabase/
    +-- migrations/
        +-- 001_initial.sql                <- Run once in Supabase SQL Editor
```

---

## Supabase Setup

### 1. Create project

1. Go to supabase.com -> **New project**
2. Name: `liquor-inventory`, save the DB password
3. Region: closest to you

### 2. Run the schema

1. Supabase Dashboard -> **SQL Editor** -> **New query**
2. Paste the contents of `supabase/migrations/001_initial.sql`
3. Press **Run** (Ctrl+Enter)
4. Verify in **Table Editor**: `locations`, `inventory_items`, `inventory_transactions` all exist
5. `inventory_items` should have 10 pre-seeded products

### 3. Get your API keys

Dashboard -> **Project Settings** -> **API**

| Key | Where it goes |
|---|---|
| Project URL | `backend/.env` and `web/.env.local` |
| anon / public key | `web/.env.local` only |
| service_role key | `backend/.env` only -- **never in the frontend** |

### 4. Create a user

Dashboard -> **Authentication** -> **Users** -> **Add user** -> **Create new user**

---

## Backend Setup

> **System Python is 3.14 and will break pydantic-core. Always activate `.venv` first.**

### First time

```bash
cd backend
uv python install 3.12
uv venv --python 3.12
source .venv/Scripts/activate      # Git Bash on Windows
pip install -r requirements.txt
```

### `.env` file

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service_role...
SUPABASE_ANON_KEY=eyJ...anon...
APP_ENV=development
```

---

## Web Frontend Setup

### First time

```bash
cd web
npm install
```

### `.env.local` file

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
NEXT_PUBLIC_API_URL=http://localhost:8001
```

> `NEXT_PUBLIC_` variables are bundled into the browser build. Never put `service_role` key here.

---

## Running the Project

Both services must be running at the same time.

### Terminal 1 -- Backend

```bash
cd backend
source .venv/Scripts/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Interactive API docs: http://localhost:8001/docs

> Port 8001 is intentional -- port 8000 is used by other tooling on this machine.

### Terminal 2 -- Web frontend

```bash
cd web
npm run dev
```

Open http://localhost:3000 in your browser.

### Run backend tests

```bash
cd backend
source .venv/Scripts/activate
pytest -v
# Expected: 25 passed
```

---

## API Endpoints

Base URL: `http://localhost:8001`

### Inventory

| Method | Path | Description |
|---|---|---|
| `GET` | `/inventory/` | List all items with current stock |
| `POST` | `/inventory/` | Create a new product |
| `GET` | `/inventory/{id}` | Get a single item |
| `GET` | `/inventory/{id}/history` | Transaction history for an item (last 50) |
| `GET` | `/inventory/{id}/display-stock` | Stock broken into cases / packs / singles |
| `GET` | `/health` | Health check |

### Sync

| Method | Path | Description |
|---|---|---|
| `POST` | `/sync/push` | Push one or more delta transactions |
| `GET` | `/sync/pull` | Pull items updated since `?since=ISO-timestamp` |

### POST /sync/push -- Request

```json
{
  "transactions": [
    {
      "client_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "item_id": "cb39416a-584c-468f-83e7-3ae4a266c75a",
      "delta_units": 48,
      "transaction_type": "restock",
      "created_at": "2026-05-31T21:00:00Z",
      "notes": "2 cases Bud Light 24-pack"
    }
  ]
}
```

`delta_units` sign: **positive = add stock, negative = remove stock**

Transaction types: `sale` | `restock` | `transfer` | `adjustment` | `count`

### POST /sync/push -- Response

```json
{
  "results": [{ "client_uuid": "...", "status": "ok" }],
  "processed": 1,
  "skipped": 0,
  "failed": 0
}
```

| Status | Meaning |
|---|---|
| `ok` | Applied successfully |
| `skipped` | `client_uuid` already in DB -- idempotent retry |
| `failed` | Would go below zero, or item not found |

---

## App Features

### Login (`/login`)
- Email + password via Supabase Auth
- Session persists in browser across page reloads
- Dark theme, inline error messages

### Inventory List (`/inventory`)
- Live search by product name or SKU
- Category filter tabs: All / Beer / Wine / Spirits / Non-alcoholic
- Each row shows stock as cases / packs / singles plus total unit count
- **- button** opens modal to remove stock (sale, adjustment, etc.)
- **+ button** opens modal to add stock (restock, count, etc.)
- Click any row to view full transaction history for that item
- Sign out in header

### Stock Adjustment Modal
- Spinner inputs for cases, packs, and singles
- Shows total unit delta before confirming
- Posts to `POST /sync/push` with a generated `client_uuid`
- Refreshes inventory list on success

### Add Product (`/inventory/add`)
- Name, SKU (optional), category, container type
- Container type auto-fills `units_per_case` and `units_per_pack`
- Initial stock field
- Posts to `POST /inventory/`

### Transaction History (`/inventory/[id]/history`)
- Full audit trail per item, most recent first
- Summary bar: total units in vs total units out
- Transaction type, timestamp, notes

---

## Unit Conversion Logic

Two implementations of the same algorithm -- keep them in sync if you change either:

| File | Language | Used by |
|---|---|---|
| `backend/app/services/base_unit_math.py` | Python | FastAPI -- authoritative, 25 tests |
| `web/lib/stock.ts` | TypeScript | Browser display + client-side validation |

### Container size reference

| container_type | units_per_case | units_per_pack |
|---|---|---|
| case_24 | 24 | 6 |
| case_30 | 30 | 1 |
| twelve_pack | 12 | 6 |
| flat_18 | 18 | 6 |
| six_pack | 6 | 1 |
| case_12 (wine/spirits) | 12 | 1 |
| case_6 (spirits) | 6 | 1 |
| single | 1 | 1 |

### Key functions (Python)

```python
# Raw units -> human display
to_display(33, units_per_case=24, units_per_pack=6)
# -> StockDisplay(cases=1, packs=1, singles=3, total_units=33)

# Human entry -> raw units
from_display(cases=1, packs=2, singles=3, units_per_case=24, units_per_pack=6)
# -> 39

# Signed delta for the ledger
delta_units(scan_cases=2, units_per_case=24, units_per_pack=6, subtract=True)
# -> -48

# Guard against negative stock
validate_delta(current_units=5, delta=-6)
# -> raises ValueError("would reduce stock below zero")
```

When `units_per_pack == 1` (wine, spirits, singles), packs fold into singles:

```python
to_display(25, units_per_case=12, units_per_pack=1)
# -> cases=2, packs=0, singles=1   (NOT packs=1)
```

---

## Sync Engine

`backend/app/services/sync_engine.py`

Processes a batch of `TransactionIn` records:

1. **Idempotency check** -- queries `inventory_transactions` for `client_uuid`. If found, returns `skipped`. Safe for retries.
2. **Stock validation** -- fetches `current_units`, calls `validate_delta()`. Rejects if result goes below zero.
3. **Atomic write** -- inserts into `inventory_transactions`, then `UPDATE inventory_items SET current_units = current_units + delta`.
4. **Per-transaction result** -- each item in the batch gets its own `ok` / `skipped` / `failed` status.

---

## Database Schema

### inventory_items

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Bud Light 24-pack" |
| sku | text | unique, nullable |
| category | text | beer / wine / spirits / non_alcoholic |
| container_type | text | case_24 / twelve_pack / etc. |
| units_per_pack | int | default 6 |
| units_per_case | int | default 24 |
| current_units | int | individual units -- constraint: >= 0 |
| location_id | uuid | FK -> locations, nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated by trigger |

### inventory_transactions

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_uuid | uuid | **UNIQUE** -- idempotency key |
| item_id | uuid | FK -> inventory_items |
| delta_units | int | signed: + add, - remove |
| transaction_type | text | sale / restock / transfer / adjustment / count |
| notes | text | nullable |
| created_at | timestamptz | recorded by client |
| server_received_at | timestamptz | set by server on insert |

### locations

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Walk-in Cooler" |
| type | text | cooler / storage / bar / other |

**Pre-seeded locations:** Walk-in Cooler, Dry Storage, Bar Well

**Pre-seeded products:** Bud Light 24pk, Bud Light 30pk, Coors Light, Miller Lite, Modelo, Corona, Heineken 12pk, White Claw 12pk, Jack Daniels 750ml, Tito`s Vodka 750ml

---

## Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key -- bypasses RLS, backend only |
| `SUPABASE_ANON_KEY` | Yes | Anon key |
| `APP_ENV` | No | `development` or `production` |

### `web/.env.local`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key -- safe for browser |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI base URL, e.g. `http://localhost:8001` |

---

## Development Commands

### Backend

```bash
cd backend
source .venv/Scripts/activate              # always first

uvicorn app.main:app --host 0.0.0.0 --port 8001            # stable
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload --reload-dir app  # dev hot-reload

pytest -v                                  # all 25 tests
pytest tests/test_base_unit_math.py -v     # single file

pip install <package> && pip freeze > requirements.txt
uv venv --python 3.12 && pip install -r requirements.txt   # recreate venv
```

### Web frontend

```bash
cd web
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve production build
```

### Git Bash aliases (add to `~/.bashrc`)

```bash
alias inv-back='cd ~/OneDrive/Documents/Inventory/backend && source .venv/Scripts/activate'
alias inv-web='cd ~/OneDrive/Documents/Inventory/web'
```

---

## Adding New Products

### Option 1 -- Web app

Navigate to `/inventory/add` and fill out the form.

### Option 2 -- API

```bash
curl -X POST http://localhost:8001/inventory/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Michelob Ultra 24-pack",
    "sku": "MICH-ULTRA-24",
    "category": "beer",
    "container_type": "case_24",
    "units_per_pack": 6,
    "units_per_case": 24,
    "initial_units": 48
  }'
```

### Option 3 -- Supabase SQL Editor

```sql
INSERT INTO inventory_items (name, sku, category, container_type, units_per_pack, units_per_case, current_units)
VALUES ('Michelob Ultra 24-pack', 'MICH-ULTRA-24', 'beer', 'case_24', 6, 24, 48);
```

---

## Troubleshooting

### Backend won`t start -- pydantic-core build error

System Python is 3.14, incompatible. Activate the venv first:

```bash
source .venv/Scripts/activate
```

### Backend keeps reloading in a loop

Watchfiles is scanning `.venv`. Drop the `--reload` flag:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Frontend shows "API error 4xx"

1. Confirm backend is running: open http://localhost:8001/docs
2. Check `NEXT_PUBLIC_API_URL` in `web/.env.local` -- restart `npm run dev` after any `.env.local` change
3. Check browser DevTools console for the exact error

### Frontend won`t start -- TypeScript errors

```bash
cd web && npx tsc --noEmit
```

### Login fails -- "Invalid login credentials"

Confirm the user exists: Supabase Dashboard -> Authentication -> Users.

### Stock went negative

The sync engine blocks this at the API level. Check `inventory_transactions` in Supabase for a row with `status: failed` and read the notes.

### Port 8001 blocked by Windows Firewall

Run in admin PowerShell:

```powershell
netsh advfirewall firewall add rule name="Inventory API" dir=in action=allow protocol=TCP localport=8001
```

---

## Roadmap

The goal is a **guided purchasing workflow** -- not just a stock tracker. The owner should be able to scan an empty shelf, get a verified pick list grouped by dealer, scan cases at the supplier to confirm the right item, and restock in one tap.

---

### Phase 1 -- Product Profiles (foundation for everything below)

Schema changes (Supabase migration required):
- [ ] Add `photo_url TEXT` to `inventory_items`
- [ ] Add `tags TEXT[]` to `inventory_items` (replaces rigid category, supports dealer names)
- [ ] Add `upc TEXT UNIQUE` to `inventory_items` (barcode lookup key)
- [ ] Add `reorder_cases INTEGER DEFAULT 2` to `inventory_items`
- [ ] Add `min_stock_units INTEGER` to `inventory_items`
- [ ] Create Supabase Storage bucket `product-photos` (public read, auth write)

UI changes:
- [ ] Product photo upload on Add Product form
- [ ] Tag input with pill UI (tap to add/remove: "beer", "harbor", "ipa", etc.)
- [ ] UPC field on Add Product form (typed or camera-scanned)
- [ ] Tag filter pills on inventory list (multi-select, replace category tabs)
- [ ] Show product photo thumbnail in each inventory row

---

### Phase 2 -- Missing Items List

New table `missing_items` (status: `missing` | `partial` | `picked` | `restocked`):
- [ ] "Mark Out" button on inventory row -- zeros stock, prompts quantity needed, adds to list
- [ ] Missing Items screen -- grouped by dealer tag
- [ ] Quantity editor per missing item (cases needed)
- [ ] Remove from list

---

### Phase 3 -- Scan-to-Verify at Supplier (the differentiating feature)

- [ ] Barcode scanner using `@zxing/browser` (cross-browser fallback for Barcode Detection API)
- [ ] "Scan to Verify Pickup" on each missing item -- opens camera
- [ ] On scan: show product photo + name + "need N cases from [dealer]" -- confirm or reject
- [ ] Wrong item flow -- keep scanning if barcode does not match expected product
- [ ] Partial fulfillment -- "only found 1 of 2 cases" sets status to `partial`
- [ ] Picked section on Missing Items screen (verified items waiting for restock)

---

### Phase 4 -- One-Tap Restock

- [ ] Restock screen -- summary of all picked items
- [ ] "Restock All" -- batch insert to `inventory_transactions`, update `current_units`, mark items `restocked`
- [ ] Clear missing list after restock

---

### Phase 5 -- Polish

- [ ] Low-stock and out-of-stock badges on inventory rows (red OUT, yellow LOW)
- [ ] "Duplicate Last Order" -- clone previous missing_items batch as starting point
- [ ] Physical count reconciliation workflow
- [ ] RBAC -- manager vs staff roles (manager can adjust, staff can only count/scan)
- [ ] CSV export -- daily transaction report
- [ ] Low-stock push notifications / email alerts

---

### Infrastructure

- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Railway or Render
- [ ] Row Level Security per store / org (multi-tenant Phase 2)
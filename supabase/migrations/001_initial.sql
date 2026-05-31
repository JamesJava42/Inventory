-- ============================================================
-- Liquor Store Inventory — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- locations — cooler sections, storage rooms, behind-the-bar
-- ============================================================
create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('cooler', 'storage', 'bar', 'other')),
  created_at  timestamptz not null default now()
);

insert into locations (name, type) values
  ('Walk-in Cooler', 'cooler'),
  ('Dry Storage',    'storage'),
  ('Bar Well',       'bar');

-- ============================================================
-- inventory_items — one row per SKU / product
-- ============================================================
create table inventory_items (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  sku             text        unique,
  category        text        not null check (category in ('beer','wine','spirits','non_alcoholic')),
  container_type  text        not null,   -- e.g. "case_24", "six_pack"
  units_per_pack  int         not null default 6,
  units_per_case  int         not null default 24,
  current_units   int         not null default 0 check (current_units >= 0),
  location_id     uuid        references locations(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at on any row change
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function touch_updated_at();

-- Seed a handful of common beer items
insert into inventory_items (name, sku, category, container_type, units_per_pack, units_per_case, current_units)
values
  ('Bud Light 24-pack',       'BUD-LIGHT-24',   'beer', 'case_24',    6, 24, 0),
  ('Bud Light 30-pack',       'BUD-LIGHT-30',   'beer', 'case_30',    1, 30, 0),
  ('Coors Light 24-pack',     'COORS-LIGHT-24', 'beer', 'case_24',    6, 24, 0),
  ('Miller Lite 24-pack',     'MILLER-LITE-24', 'beer', 'case_24',    6, 24, 0),
  ('Modelo Especial 24-pack', 'MODELO-24',      'beer', 'case_24',    6, 24, 0),
  ('Corona Extra 24-pack',    'CORONA-24',      'beer', 'case_24',    6, 24, 0),
  ('Heineken 12-pack',        'HEINEKEN-12',    'beer', 'twelve_pack', 6, 12, 0),
  ('White Claw 12-pack',      'WCLAW-12',       'beer', 'twelve_pack', 6, 12, 0),
  ('Jack Daniels 750ml',      'JD-750',        'spirits','case_12',   1, 12, 0),
  ('Tito s Vodka 750ml',      'TITOS-750',     'spirits','case_12',   1, 12, 0);

-- ============================================================
-- inventory_transactions — the delta ledger
-- ============================================================
create table inventory_transactions (
  id                uuid        primary key default gen_random_uuid(),
  client_uuid       uuid        not null unique,   -- idempotency key from mobile
  item_id           uuid        not null references inventory_items(id),
  delta_units       int         not null,           -- signed: + = add, - = remove
  transaction_type  text        not null check (
                      transaction_type in ('sale','restock','transfer','adjustment','count')
                    ),
  notes             text,
  created_at        timestamptz not null default now(),
  server_received_at timestamptz not null default now()
);

create index on inventory_transactions (item_id);
create index on inventory_transactions (created_at);
create index on inventory_transactions (client_uuid);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table locations            enable row level security;
alter table inventory_items      enable row level security;
alter table inventory_transactions enable row level security;

-- Allow authenticated users full access (scope down per role later)
create policy "authenticated full access" on locations
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on inventory_items
  for all using (auth.role() = 'authenticated');

create policy "authenticated full access" on inventory_transactions
  for all using (auth.role() = 'authenticated');

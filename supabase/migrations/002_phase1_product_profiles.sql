-- ============================================================
-- Phase 1: Product Profile columns
-- Run in Supabase SQL Editor after 001_initial.sql
-- ============================================================

-- New columns on inventory_items
alter table inventory_items
  add column if not exists photo_url      text,
  add column if not exists tags           text[]  not null default '{}',
  add column if not exists upc            text    unique,
  add column if not exists reorder_cases  int     not null default 2,
  add column if not exists min_stock_units int;

-- Fast tag lookups (any tag value)
create index if not exists idx_inventory_items_tags
  on inventory_items using gin(tags);

-- Fast UPC barcode lookup
create index if not exists idx_inventory_items_upc
  on inventory_items(upc);

-- Back-fill tags from existing category values so filter still works
update inventory_items
  set tags = array[category]
  where tags = '{}';

-- ============================================================
-- missing_items — the pick list / shopping cart
-- ============================================================
create table if not exists missing_items (
  id              uuid        primary key default gen_random_uuid(),
  item_id         uuid        not null references inventory_items(id) on delete cascade,
  cases_needed    int         not null default 1 check (cases_needed > 0),
  cases_picked    int         not null default 0 check (cases_picked >= 0),
  status          text        not null default 'missing'
                              check (status in ('missing','partial','picked','restocked')),
  picked_at       timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists idx_missing_items_status on missing_items(status);
create index if not exists idx_missing_items_item   on missing_items(item_id);

alter table missing_items enable row level security;

create policy "authenticated full access" on missing_items
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- Storage bucket for product photos
-- Create the bucket manually in Supabase Dashboard:
--   Storage > New bucket > "product-photos"
--   Public bucket: ON
-- Then run this policy:
-- ============================================================
-- (Storage bucket policies are managed via the Dashboard or API,
--  not plain SQL — reminder only, nothing to execute here)

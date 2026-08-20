-- ---------------------------------------------------------------------------
-- ingredients (sklad surovín) / stock receipts (skladové príjemky)
-- ---------------------------------------------------------------------------
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('malt', 'hops', 'yeast', 'other')),
  unit text not null default 'kg',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_ingredients_category on ingredients (category);

create table stock_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_date date not null,
  supplier text not null,
  document_number text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table stock_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references stock_receipts (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity numeric not null,
  unit_price numeric,
  notes text
);

create index idx_stock_receipt_items_receipt on stock_receipt_items (receipt_id);
create index idx_stock_receipt_items_ingredient on stock_receipt_items (ingredient_id);

-- ---------------------------------------------------------------------------
-- create_stock_receipt: inserts a receipt + its line items in one transaction
-- ---------------------------------------------------------------------------
create or replace function create_stock_receipt(
  p_receipt_date date,
  p_supplier text,
  p_document_number text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_receipt_id uuid;
begin
  insert into stock_receipts (receipt_date, supplier, document_number, created_by)
  values (p_receipt_date, p_supplier, p_document_number, auth.uid())
  returning id into v_receipt_id;

  insert into stock_receipt_items (receipt_id, ingredient_id, quantity, unit_price, notes)
  select
    v_receipt_id,
    (item->>'ingredient_id')::uuid,
    (item->>'quantity')::numeric,
    nullif(item->>'unit_price', '')::numeric,
    nullif(item->>'notes', '')
  from jsonb_array_elements(p_items) as item;

  return v_receipt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table ingredients enable row level security;
alter table stock_receipts enable row level security;
alter table stock_receipt_items enable row level security;

create policy "authenticated read/write" on ingredients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on stock_receipts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on stock_receipt_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

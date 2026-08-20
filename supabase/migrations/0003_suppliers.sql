-- ---------------------------------------------------------------------------
-- suppliers (dodávatelia) — normalize stock_receipts.supplier into its own
-- managed catalog, same soft-delete pattern as tanks/ingredients
-- ---------------------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- backfill from existing free-text supplier names on stock_receipts
insert into suppliers (name)
select distinct supplier from stock_receipts;

alter table stock_receipts add column supplier_id uuid references suppliers (id);

update stock_receipts sr
set supplier_id = s.id
from suppliers s
where s.name = sr.supplier;

alter table stock_receipts alter column supplier_id set not null;
alter table stock_receipts drop column supplier;

create index idx_stock_receipts_supplier on stock_receipts (supplier_id);

-- ---------------------------------------------------------------------------
-- create_stock_receipt now takes a supplier_id instead of free text
-- ---------------------------------------------------------------------------
drop function if exists create_stock_receipt(date, text, text, jsonb);

create or replace function create_stock_receipt(
  p_receipt_date date,
  p_supplier_id uuid,
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
  insert into stock_receipts (receipt_date, supplier_id, document_number, created_by)
  values (p_receipt_date, p_supplier_id, p_document_number, auth.uid())
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
alter table suppliers enable row level security;

create policy "authenticated read/write" on suppliers
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- stock_receipt_items: track a total price per line item (not a per-unit
-- price) so the receipt can show a total sum. The unit_price column was
-- never populated by the app, so this is a safe rename.
-- ---------------------------------------------------------------------------
alter table stock_receipt_items rename column unit_price to total_price;

drop function if exists create_stock_receipt(date, uuid, text, jsonb);

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

  insert into stock_receipt_items (receipt_id, ingredient_id, quantity, total_price, notes)
  select
    v_receipt_id,
    (item->>'ingredient_id')::uuid,
    (item->>'quantity')::numeric,
    nullif(item->>'total_price', '')::numeric,
    nullif(item->>'notes', '')
  from jsonb_array_elements(p_items) as item;

  return v_receipt_id;
end;
$$;

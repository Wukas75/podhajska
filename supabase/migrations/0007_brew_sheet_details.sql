-- ---------------------------------------------------------------------------
-- brew_sheets: sequential batch number + brew date; backfilled for any
-- existing rows (batch_number by creation order, brew_date from created_at)
-- ---------------------------------------------------------------------------
alter table brew_sheets add column batch_number integer;
alter table brew_sheets add column brew_date date;

update brew_sheets set brew_date = created_at::date where brew_date is null;

with numbered as (
  select id, row_number() over (order by created_at) as rn
  from brew_sheets
  where batch_number is null
)
update brew_sheets bs
set batch_number = numbered.rn
from numbered
where bs.id = numbered.id;

alter table brew_sheets alter column brew_date set not null;
alter table brew_sheets alter column batch_number set not null;

-- ---------------------------------------------------------------------------
-- brew_sheet_ingredients: price per line item (same "total, not per-unit"
-- convention as stock_receipt_items.total_price)
-- ---------------------------------------------------------------------------
alter table brew_sheet_ingredients add column total_price numeric;

-- ---------------------------------------------------------------------------
-- create_brew_sheet_from_recipe: now also takes batch_number and brew_date
-- ---------------------------------------------------------------------------
drop function if exists create_brew_sheet_from_recipe(text, uuid, numeric);

create or replace function create_brew_sheet_from_recipe(
  p_name text,
  p_recipe_id uuid,
  p_batch_volume_liters numeric,
  p_batch_number integer,
  p_brew_date date
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_sheet_id uuid;
begin
  insert into brew_sheets (name, recipe_id, batch_volume_liters, batch_number, brew_date, created_by)
  values (p_name, p_recipe_id, p_batch_volume_liters, p_batch_number, p_brew_date, auth.uid())
  returning id into v_sheet_id;

  insert into brew_sheet_ingredients (brew_sheet_id, ingredient_id, quantity)
  select v_sheet_id, ri.ingredient_id, ri.quantity
  from recipe_ingredients ri
  where ri.recipe_id = p_recipe_id;

  return v_sheet_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- brew_sheets (varné listy) — an editable, standalone worklist of
-- ingredients for a brew day. Can be seeded from a recipe (a snapshot
-- copy of its ingredient lines) and then freely edited, independent of
-- both the source recipe and any batch/tank.
-- ---------------------------------------------------------------------------
create table brew_sheets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  recipe_id uuid references recipes (id),
  batch_volume_liters numeric not null,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table brew_sheet_ingredients (
  id uuid primary key default gen_random_uuid(),
  brew_sheet_id uuid not null references brew_sheets (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity numeric not null,
  notes text
);

create index idx_brew_sheet_ingredients_sheet on brew_sheet_ingredients (brew_sheet_id);

-- ---------------------------------------------------------------------------
-- create_brew_sheet_from_recipe: seeds a new brew sheet with a snapshot of
-- the given recipe's ingredient lines
-- ---------------------------------------------------------------------------
create or replace function create_brew_sheet_from_recipe(
  p_name text,
  p_recipe_id uuid,
  p_batch_volume_liters numeric
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_sheet_id uuid;
begin
  insert into brew_sheets (name, recipe_id, batch_volume_liters, created_by)
  values (p_name, p_recipe_id, p_batch_volume_liters, auth.uid())
  returning id into v_sheet_id;

  insert into brew_sheet_ingredients (brew_sheet_id, ingredient_id, quantity)
  select v_sheet_id, ri.ingredient_id, ri.quantity
  from recipe_ingredients ri
  where ri.recipe_id = p_recipe_id;

  return v_sheet_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table brew_sheets enable row level security;
alter table brew_sheet_ingredients enable row level security;

create policy "authenticated read/write" on brew_sheets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on brew_sheet_ingredients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

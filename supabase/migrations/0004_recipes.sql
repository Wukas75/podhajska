-- ---------------------------------------------------------------------------
-- recipes (receptúry) — ingredient formulations, independent of
-- recipe_templates (which model the brewing process/steps timeline)
-- ---------------------------------------------------------------------------
create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text,
  batch_volume_liters numeric not null,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  quantity numeric not null,
  notes text
);

create index idx_recipe_ingredients_recipe on recipe_ingredients (recipe_id);
create index idx_recipe_ingredients_ingredient on recipe_ingredients (ingredient_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;

create policy "authenticated read/write" on recipes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on recipe_ingredients
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

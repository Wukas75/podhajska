-- ---------------------------------------------------------------------------
-- process_step_templates: a single reusable "Postup varenia" table managed
-- from Nastavenia, so it doesn't need to be rebuilt for every brew sheet.
-- Same 6-column shape as brew_sheet_process_steps.
-- ---------------------------------------------------------------------------
create table process_step_templates (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  step_name text,
  value_2 text,
  value_3 text,
  value_4 text,
  value_5 text,
  value_6 text,
  created_at timestamptz not null default now()
);

alter table process_step_templates enable row level security;

create policy "authenticated read/write" on process_step_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- copy_process_steps_to_brew_sheet: inserts the current template rows into
-- a brew sheet's own process step table, appended after any existing rows
-- ---------------------------------------------------------------------------
create or replace function copy_process_steps_to_brew_sheet(p_brew_sheet_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_offset int;
begin
  select coalesce(max(sort_order) + 1, 0) into v_offset
  from brew_sheet_process_steps
  where brew_sheet_id = p_brew_sheet_id;

  insert into brew_sheet_process_steps (brew_sheet_id, sort_order, step_name, value_2, value_3, value_4, value_5, value_6)
  select p_brew_sheet_id, v_offset + row_number() over (order by sort_order) - 1,
         step_name, value_2, value_3, value_4, value_5, value_6
  from process_step_templates;
end;
$$;

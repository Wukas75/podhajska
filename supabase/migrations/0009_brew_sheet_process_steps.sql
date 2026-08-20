-- ---------------------------------------------------------------------------
-- brew_sheet_process_steps: postup varenia — rows of a 6-column table per
-- brew sheet. Column 1 is a step label (e.g. "Ohrev"), columns 2-6 are
-- free-text/manual-entry fields whose meaning isn't fixed yet.
-- ---------------------------------------------------------------------------
create table brew_sheet_process_steps (
  id uuid primary key default gen_random_uuid(),
  brew_sheet_id uuid not null references brew_sheets (id) on delete cascade,
  sort_order int not null default 0,
  step_name text,
  value_2 text,
  value_3 text,
  value_4 text,
  value_5 text,
  value_6 text,
  created_at timestamptz not null default now()
);

create index idx_brew_sheet_process_steps_sheet on brew_sheet_process_steps (brew_sheet_id, sort_order);

alter table brew_sheet_process_steps enable row level security;

create policy "authenticated read/write" on brew_sheet_process_steps
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

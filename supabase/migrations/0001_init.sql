-- Fermentation Tracker — initial schema
-- Small trusted team, no multi-tenancy: any authenticated user can read/write shared data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- tanks
-- ---------------------------------------------------------------------------
create table tanks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity_liters numeric,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recipe_templates / recipe_template_steps
-- ---------------------------------------------------------------------------
create table recipe_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  style text,
  description text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table recipe_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references recipe_templates (id) on delete cascade,
  day_offset int not null,
  time_of_day time not null default '09:00',
  title text not null,
  instruction text,
  step_type text not null check (step_type in ('temperature', 'gravity', 'dry_hop', 'transfer', 'custom')),
  target_value numeric,
  target_unit text,
  sort_order int not null default 0
);

create index idx_recipe_template_steps_template on recipe_template_steps (template_id);

-- ---------------------------------------------------------------------------
-- batches / batch_steps
-- ---------------------------------------------------------------------------
create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tank_id uuid references tanks (id),
  template_id uuid references recipe_templates (id),
  start_date date not null,
  status text not null default 'active' check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_batches_tank on batches (tank_id);
create index idx_batches_status on batches (status);

create table batch_steps (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches (id) on delete cascade,
  template_step_id uuid references recipe_template_steps (id),
  day_offset int not null,
  due_at timestamptz not null,
  title text not null,
  instruction text,
  step_type text not null check (step_type in ('temperature', 'gravity', 'dry_hop', 'transfer', 'custom')),
  target_value numeric,
  target_unit text,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  actual_value numeric,
  actual_unit text,
  notes text,
  completed_by uuid references profiles (id),
  completed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_batch_steps_batch on batch_steps (batch_id);

-- used by the notification cron job to find due, not-yet-notified steps
create index idx_batch_steps_due_pending
  on batch_steps (due_at)
  where status = 'pending' and notified_at is null;

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  expo_push_token text not null,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

-- ---------------------------------------------------------------------------
-- create_batch_from_template: generates a batch + its dated steps in one transaction
-- ---------------------------------------------------------------------------
create or replace function create_batch_from_template(
  p_template_id uuid,
  p_tank_id uuid,
  p_start_date date,
  p_name text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  insert into batches (name, tank_id, template_id, start_date, status, created_by)
  values (p_name, p_tank_id, p_template_id, p_start_date, 'active', auth.uid())
  returning id into v_batch_id;

  insert into batch_steps (
    batch_id, template_step_id, day_offset, due_at,
    title, instruction, step_type, target_value, target_unit
  )
  select
    v_batch_id,
    rts.id,
    rts.day_offset,
    (p_start_date + rts.day_offset * interval '1 day') + rts.time_of_day,
    rts.title,
    rts.instruction,
    rts.step_type,
    rts.target_value,
    rts.target_unit
  from recipe_template_steps rts
  where rts.template_id = p_template_id
  order by rts.sort_order;

  return v_batch_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table tanks enable row level security;
alter table recipe_templates enable row level security;
alter table recipe_template_steps enable row level security;
alter table batches enable row level security;
alter table batch_steps enable row level security;
alter table push_tokens enable row level security;

create policy "any authenticated user can read profiles"
  on profiles for select
  using (auth.uid() is not null);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "authenticated read/write" on tanks
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on recipe_templates
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on recipe_template_steps
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on batches
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on batch_steps
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "users manage their own push tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

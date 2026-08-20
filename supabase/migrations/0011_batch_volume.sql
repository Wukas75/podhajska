-- ---------------------------------------------------------------------------
-- batches: volume_liters, settable at creation (e.g. from a brew sheet's
-- final volume) and editable afterwards
-- ---------------------------------------------------------------------------
alter table batches add column volume_liters numeric;

drop function if exists create_batch_from_template(uuid, uuid, date, text);

create or replace function create_batch_from_template(
  p_template_id uuid,
  p_tank_id uuid,
  p_start_date date,
  p_name text,
  p_volume_liters numeric default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_batch_id uuid;
begin
  insert into batches (name, tank_id, template_id, start_date, status, volume_liters, created_by)
  values (p_name, p_tank_id, p_template_id, p_start_date, 'active', p_volume_liters, auth.uid())
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

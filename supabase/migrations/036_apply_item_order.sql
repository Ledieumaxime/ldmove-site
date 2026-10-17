-- Reorder and regroup a session's exercises in one round trip.
--
-- The block editor used to send one PATCH per moved row: moving a
-- superset or inserting inside one took up to 18 sequential requests,
-- 3 to 5 seconds on a phone, and a failure halfway left the session
-- half-renumbered. One call now applies every new order_index and
-- group_name in a single UPDATE, so it is atomic as well as fast.
--
-- p_updates: [{"id": uuid, "order_index"?: int, "group_name"?: text|null}]
-- A key that is absent leaves that column alone; "group_name": null
-- turns the row into a single exercise.
--
-- Returns how many rows were updated. SECURITY INVOKER keeps the
-- "program_items: coach write" policy in charge: for anyone but the
-- coach the update matches nothing and returns 0, which the editor
-- treats as a failed save instead of a silent no-op.

create or replace function public.apply_item_order(p_updates jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with changed as (
    update public.program_items pi
    set order_index = case when u ? 'order_index'
                           then (u->>'order_index')::int
                           else pi.order_index end,
        group_name  = case when u ? 'group_name'
                           then u->>'group_name'
                           else pi.group_name end
    from jsonb_array_elements(p_updates) as u
    where pi.id = (u->>'id')::uuid
    returning 1
  )
  select count(*)::int from changed;
$$;

revoke execute on function public.apply_item_order(jsonb) from public, anon;
grant execute on function public.apply_item_order(jsonb) to authenticated;

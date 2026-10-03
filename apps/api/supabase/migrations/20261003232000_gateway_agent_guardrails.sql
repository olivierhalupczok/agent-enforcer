-- B-02: the gateway loads an agent's guardrails without a signed-in user.
-- Returns null for a wrong key, otherwise every mandatory guardrail, the guardrails bound to
-- this agent (in library order) and the agent's bindings. Ordering is done in the API
-- (app.bindings.resolve), so the rules live in one place.
create or replace function public.gateway_agent_guardrails(p_agent_id uuid, p_key_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with agent_bindings as (
        select b.*
        from public.rule_bindings b
        where b.scope_type = 'agent'
          and b.scope_id = p_agent_id::text
    )
    select case
        when exists (
            select 1
            from public.agents a
            where a.id = p_agent_id
              and a.gateway_key_hash = p_key_hash
        )
        then jsonb_build_object(
            'guardrails', coalesce((
                select jsonb_agg(to_jsonb(g) order by g.position)
                from public.guardrails g
                where g.is_mandatory
                   or g.id in (select guardrail_id from agent_bindings)
            ), '[]'::jsonb),
            'bindings', coalesce((
                select jsonb_agg(to_jsonb(b) order by b.order_index, b.position)
                from agent_bindings b
            ), '[]'::jsonb)
        )
    end;
$$;

revoke all on function public.gateway_agent_guardrails(uuid, text) from public;
grant execute on function public.gateway_agent_guardrails(uuid, text) to anon, authenticated;
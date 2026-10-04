-- B-02 follow-up: the gateway also resolves role-scoped bindings (demo sends role in the body).
drop function if exists public.gateway_agent_guardrails(uuid, text);

create function public.gateway_agent_guardrails(
    p_agent_id uuid,
    p_key_hash text,
    p_role text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with scoped_bindings as (
        select b.*
        from public.rule_bindings b
        where (b.scope_type = 'agent' and b.scope_id = p_agent_id::text)
           or (
               p_role is not null
               and b.scope_type = 'role'
               and b.scope_id = p_role
           )
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
                   or g.id in (select guardrail_id from scoped_bindings)
            ), '[]'::jsonb),
            'bindings', coalesce((
                select jsonb_agg(to_jsonb(b) order by b.order_index, b.position)
                from scoped_bindings b
            ), '[]'::jsonb)
        )
    end;
$$;

revoke all on function public.gateway_agent_guardrails(uuid, text, text) from public;
grant execute on function public.gateway_agent_guardrails(uuid, text, text) to anon, authenticated;

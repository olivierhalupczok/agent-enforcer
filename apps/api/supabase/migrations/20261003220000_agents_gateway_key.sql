-- B-01: each agent gets a gateway key. Callers send it to /a/<agent id>; the gateway checks it
-- and forwards the request to the agent's upstream_url. Only a SHA-256 hash is stored.
alter table public.agents
add column gateway_key_hash text;

alter table public.agents
add constraint agents_gateway_key_hash_check
    check (gateway_key_hash is null or gateway_key_hash ~ '^[0-9a-f]{64}$');

comment on column public.agents.gateway_key_hash is
    'SHA-256 (hex) of the agent''s gateway key. The key itself is shown once and never stored.';

-- The gateway runs without a signed-in user, so it cannot read agents through RLS.
-- This function returns an agent's upstream settings ONLY to a caller that knows its gateway key.
create function public.gateway_resolve_agent(p_agent_id uuid, p_key_hash text)
returns table (
    upstream_url text,
    auth_header_name text,
    auth_header_value text
)
language sql
stable
security definer
set search_path = ''
as $$
    select a.upstream_url, a.auth_header_name, a.auth_header_value
    from public.agents as a
    where a.id = p_agent_id
      and a.gateway_key_hash is not null
      and a.gateway_key_hash = p_key_hash;
$$;

comment on function public.gateway_resolve_agent(uuid, text) is
    'Gateway lookup (B-01): upstream settings for an agent, only when the key hash matches.';

revoke all on function public.gateway_resolve_agent(uuid, text) from public;
grant execute on function public.gateway_resolve_agent(uuid, text) to anon, authenticated;
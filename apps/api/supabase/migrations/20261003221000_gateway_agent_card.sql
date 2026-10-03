-- B-01: the guarded Agent Card (GET /a/<agent id>/.well-known/agent-card.json) is public, like
-- any A2A Agent Card, so the gateway needs the agent's base URL without a key. Only agents that
-- have a gateway key are served, and nothing secret is returned: no auth header.
create or replace function public.gateway_agent_base_url(p_agent_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select a.upstream_url
    from public.agents a
    where a.id = p_agent_id
      and a.gateway_key_hash is not null;
$$;

revoke all on function public.gateway_agent_base_url(uuid) from public;
grant execute on function public.gateway_agent_base_url(uuid) to anon, authenticated;
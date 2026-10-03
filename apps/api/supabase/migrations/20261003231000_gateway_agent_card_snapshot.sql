-- B-01: the guarded Agent Card (GET /a/<agent id>/.well-known/agent-card.json) is public, like
-- any A2A Agent Card. It is built from the card snapshot stored at registration
-- (agents.agent_card, see 20261003230000_agents_a2a.sql), so no upstream call is needed.
-- Only agents that have a gateway key are served; nothing secret is returned.
-- Replaces gateway_agent_base_url from 20261003221000_gateway_agent_card.sql.
drop function if exists public.gateway_agent_base_url(uuid);

create or replace function public.gateway_agent_card(p_agent_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select a.agent_card
    from public.agents a
    where a.id = p_agent_id
      and a.gateway_key_hash is not null;
$$;

revoke all on function public.gateway_agent_card(uuid) from public;
grant execute on function public.gateway_agent_card(uuid) to anon, authenticated;
-- FR-17 fix: managing an agent's MCP access follows who can SEE the agent, not who owns it.
-- In production the agents table is shared (every signed-in user can read every agent), but the
-- agent_mcp_servers policies demanded ownership, so granting a server to an agent you could see
-- was refused (RLS -> the API's "Agent not found"). The checks below run under the caller's own
-- RLS on agents, so they follow whatever the agents visibility rules are: owner-only or shared.

drop policy if exists "Owners can read their agents' MCP access" on public.agent_mcp_servers;
drop policy if exists "Owners can grant their agents MCP access" on public.agent_mcp_servers;
drop policy if exists "Owners can change their agents' MCP access" on public.agent_mcp_servers;
drop policy if exists "Owners can revoke their agents' MCP access" on public.agent_mcp_servers;

create policy "Users who see an agent can read its MCP access"
on public.agent_mcp_servers for select to authenticated
using (exists (select 1 from public.agents as a where a.id = agent_mcp_servers.agent_id));

create policy "Users who see an agent can grant it MCP access"
on public.agent_mcp_servers for insert to authenticated
with check (exists (select 1 from public.agents as a where a.id = agent_mcp_servers.agent_id));

create policy "Users who see an agent can change its MCP access"
on public.agent_mcp_servers for update to authenticated
using (exists (select 1 from public.agents as a where a.id = agent_mcp_servers.agent_id))
with check (exists (select 1 from public.agents as a where a.id = agent_mcp_servers.agent_id));

create policy "Users who see an agent can revoke its MCP access"
on public.agent_mcp_servers for delete to authenticated
using (exists (select 1 from public.agents as a where a.id = agent_mcp_servers.agent_id));

-- The test chat's lookup now runs with the caller's rights (security invoker), so it answers for
-- exactly the agents the caller can see. It returns no credentials either way.
create or replace function public.owner_agent_mcp_servers(p_agent_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
    select case
        when exists (select 1 from public.agents as a where a.id = p_agent_id)
        then coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'id', m.id, 'name', m.name, 'url', m.url, 'allowedTools', s.allowed_tools
                )
                order by m.position
            )
            from public.agent_mcp_servers as s
            join public.mcp_servers as m on m.id = s.server_id
            where s.agent_id = p_agent_id
        ), '[]'::jsonb)
    end;
$$;

comment on function public.owner_agent_mcp_servers(uuid) is
    'Test chat (FR-17): the MCP servers and tools of an agent the caller can see.';

-- MCP servers registry (FR-16): tool servers registered once and attached to agents.
-- Shared by the whole company, like the guardrail library: any signed-in user may read and edit it.
create table public.mcp_servers (
    id text primary key,
    position bigint generated always as identity,
    name text not null,
    url text not null,
    auth_type text not null,
    auth_header text,
    auth_secret text,
    oauth_token_url text,
    oauth_client_id text,
    oauth_scopes text[] not null default '{}',
    allowed_tools text[] not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint mcp_servers_id_check
        check (id ~ '^[a-z0-9][a-z0-9-]*$'),
    constraint mcp_servers_name_length_check
        check (char_length(btrim(name)) between 1 and 80),
    constraint mcp_servers_url_check
        check (url ~* '^https?://[^[:space:]]+$'),
    constraint mcp_servers_auth_type_check
        check (auth_type in ('none', 'api_key', 'oauth')),
    constraint mcp_servers_auth_fields_check
        check (
            (
                auth_type = 'none'
                and auth_header is null and auth_secret is null
                and oauth_token_url is null and oauth_client_id is null
            )
            or (
                auth_type = 'api_key'
                and auth_header is not null and auth_secret is not null
                and oauth_token_url is null and oauth_client_id is null
            )
            or (
                auth_type = 'oauth'
                and auth_header is null and auth_secret is not null
                and oauth_token_url is not null and oauth_client_id is not null
            )
        ),
    constraint mcp_servers_allowed_tools_check
        check (cardinality(allowed_tools) >= 1)
);

comment on table public.mcp_servers is
    'MCP tool servers registered once and attached to the agents that may use them (FR-16).';
comment on column public.mcp_servers.auth_secret is
    'API key or OAuth client secret. Write-only for users: never selectable, never returned.';
comment on column public.mcp_servers.position is
    'Insertion order; the API lists servers in this order.';

-- Names are unique, case-insensitively ("Order lookup" and "order lookup" clash).
create unique index mcp_servers_name_unique on public.mcp_servers (lower(name));

create function public.set_mcp_servers_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_mcp_servers_updated_at
before update on public.mcp_servers
for each row
execute function public.set_mcp_servers_updated_at();

alter table public.mcp_servers enable row level security;

create policy "Signed-in users can read MCP servers"
on public.mcp_servers
for select
to authenticated
using (true);

create policy "Signed-in users can register MCP servers"
on public.mcp_servers
for insert
to authenticated
with check (true);

create policy "Signed-in users can update MCP servers"
on public.mcp_servers
for update
to authenticated
using (true)
with check (true);

create policy "Signed-in users can delete MCP servers"
on public.mcp_servers
for delete
to authenticated
using (true);

revoke all on table public.mcp_servers from anon, authenticated;

-- Signed-in users can read every column EXCEPT auth_secret, so a secret cannot be read back
-- even by querying Supabase directly. They can still write it when registering a server.
grant select (
    id, position, name, url, auth_type, auth_header, oauth_token_url, oauth_client_id,
    oauth_scopes, allowed_tools, created_at, updated_at
) on table public.mcp_servers to authenticated;
grant insert, update, delete on table public.mcp_servers to authenticated;
grant all on table public.mcp_servers to service_role;
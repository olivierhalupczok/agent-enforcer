-- FR-05: which guardrails apply to an agent, a role or a single user.
-- Mandatory guardrails (guardrails.is_mandatory) are not stored here: they apply everywhere.
create table public.rule_bindings (
    id text primary key,
    position bigint generated always as identity,
    scope_type text not null,
    scope_id text not null,
    guardrail_id text not null references public.guardrails(id) on delete cascade,
    order_index integer not null default 0,
    enabled boolean not null default true,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint rule_bindings_id_check
        check (id ~ '^[a-z0-9][a-z0-9-]*$'),
    constraint rule_bindings_scope_type_check
        check (scope_type in ('agent', 'role', 'user')),
    constraint rule_bindings_scope_id_length_check
        check (char_length(btrim(scope_id)) between 1 and 120),
    constraint rule_bindings_order_index_check
        check (order_index between 0 and 9999),
    constraint rule_bindings_unique_attachment
        unique (scope_type, scope_id, guardrail_id)
);

create index rule_bindings_scope_idx
    on public.rule_bindings (scope_type, scope_id, order_index);

comment on table public.rule_bindings is
    'Attachments of library guardrails to agents, roles and users (FR-05).';
comment on column public.rule_bindings.order_index is
    'Execution order within a scope; ties break agent, then role, then user.';

create trigger set_rule_bindings_updated_at
before update on public.rule_bindings
for each row
execute function public.set_guardrails_updated_at();

-- Same access as the guardrail library: signed-in users manage it, anon gets nothing.
alter table public.rule_bindings enable row level security;

revoke all on table public.rule_bindings from anon, authenticated;
grant all on table public.rule_bindings to service_role;

create policy "Signed-in users can read rule bindings"
on public.rule_bindings
for select
to authenticated
using (true);

create policy "Signed-in users can create rule bindings"
on public.rule_bindings
for insert
to authenticated
with check (true);

create policy "Signed-in users can update rule bindings"
on public.rule_bindings
for update
to authenticated
using (true)
with check (true);

create policy "Signed-in users can delete rule bindings"
on public.rule_bindings
for delete
to authenticated
using (true);

grant select, insert, update, delete on table public.rule_bindings to authenticated;

-- Company-wide guardrail library (D-05 / FR-03). Not per user: every agent can attach any of these.
-- Only the API writes here, using the server-side secret key; the browser never talks to this table.
create table public.guardrails (
    id text primary key,
    position bigint generated always as identity,
    name text not null,
    description text,
    engine text not null,
    stages text[] not null,
    action text not null,
    config jsonb not null,
    enabled boolean not null default true,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),

    constraint guardrails_id_check
        check (id ~ '^[a-z0-9][a-z0-9-]*$'),
    constraint guardrails_name_length_check
        check (char_length(btrim(name)) between 1 and 80),
    constraint guardrails_description_length_check
        check (description is null or char_length(description) <= 200),
    constraint guardrails_engine_check
        check (engine in ('regex', 'llm_judge', 'library', 'moderation')),
    constraint guardrails_stages_check
        check (
            cardinality(stages) between 1 and 2
            and stages <@ array['input', 'output']::text[]
        ),
    constraint guardrails_action_check
        check (action in ('block', 'redact', 'warn')),
    constraint guardrails_config_check
        check (
            jsonb_typeof(config) = 'object'
            and config ->> 'template' in
                ('pii', 'prompt_injection', 'toxicity', 'topic', 'regex', 'llm_judge')
        )
);

comment on table public.guardrails is
    'Company guardrail library. Each guardrail runs exactly one engine.';
comment on column public.guardrails.position is
    'Insertion order; the API lists guardrails in this order (seeds first).';
comment on column public.guardrails.config is
    'Template-specific settings; always contains the template id under "template".';

create function public.set_guardrails_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_guardrails_updated_at
before update on public.guardrails
for each row
execute function public.set_guardrails_updated_at();

-- RLS on with no policies: anon and authenticated users get nothing.
-- The API uses the service role (secret key), which bypasses RLS.
alter table public.guardrails enable row level security;

revoke all on table public.guardrails from anon, authenticated;
grant all on table public.guardrails to service_role;
-- FR-06: a mandatory guardrail applies to every agent and cannot be attached or detached.
-- The model already had the flag; without this column Supabase dropped it on every write.
alter table public.guardrails
    add column is_mandatory boolean not null default false;

comment on column public.guardrails.is_mandatory is
    'Applies to every request regardless of bindings, and always runs first (FR-06/FR-07).';

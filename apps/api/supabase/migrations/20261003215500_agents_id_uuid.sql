-- The hosted project's agents.id ended up as text (created outside these migrations), while
-- 20261003162428_table_agents.sql declares uuid. Later migrations compare it with uuid
-- parameters and reference it from uuid foreign keys, so bring it back to uuid.
-- A no-op on databases built from these migrations. Fails (and rolls back) if a row's id is
-- not a valid UUID, rather than silently dropping it.
--
-- The hosted table also has CHECK constraints on id written for text (e.g. id ~ '<regex>').
-- Postgres re-checks them after the type change and fails with "operator does not exist:
-- uuid ~ text", so they are dropped first. The uuid type itself now guarantees the format.
do $$
declare
    id_column smallint;
    constraint_name text;
begin
    if (
        select data_type
        from information_schema.columns
        where table_schema = 'public' and table_name = 'agents' and column_name = 'id'
    ) <> 'uuid' then
        -- NEW: drop every CHECK constraint that uses the id column
        select attnum into id_column
        from pg_attribute
        where attrelid = 'public.agents'::regclass and attname = 'id';

        for constraint_name in
            select conname
            from pg_constraint
            where conrelid = 'public.agents'::regclass
              and contype = 'c'
              and id_column = any (conkey)
        loop
            execute format('alter table public.agents drop constraint %I', constraint_name);
        end loop;
        -- END NEW

        alter table public.agents alter column id drop default;
        alter table public.agents alter column id type uuid using id::uuid;
        alter table public.agents alter column id set default gen_random_uuid();
    end if;
end;
$$;
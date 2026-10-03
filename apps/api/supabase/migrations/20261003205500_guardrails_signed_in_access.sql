-- The guardrail library is shared by the whole company: any signed-in user may read and edit it.
-- Signed-out visitors (anon) get nothing. Per-role limits come later with A-08 (users and roles).

create policy "Signed-in users can read guardrails"
on public.guardrails
for select
to authenticated
using (true);

create policy "Signed-in users can create guardrails"
on public.guardrails
for insert
to authenticated
with check (true);

create policy "Signed-in users can update guardrails"
on public.guardrails
for update
to authenticated
using (true)
with check (true);

create policy "Signed-in users can delete guardrails"
on public.guardrails
for delete
to authenticated
using (true);

grant select, insert, update, delete on table public.guardrails to authenticated;
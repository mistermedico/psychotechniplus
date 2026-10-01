-- Admins must see (and therefore be able to update/upsert) questions in every validation
-- status. Previously the only SELECT policy allowed validated rows, so pending/rejected
-- questions were invisible in the admin and UPDATE/UPSERT of non-validated rows failed RLS.
-- anon keeps a catalog-only policy (anon has no EXECUTE on is_app_admin()).
drop policy if exists admin_read_questions on public.questions;
drop policy if exists catalog_read_questions on public.questions;
drop policy if exists authenticated_read_questions on public.questions;

create policy catalog_read_questions on public.questions
  for select to anon
  using ((validation_status = 'validated') and ((coalesce(access_level, 'free') <> 'premium') or private.has_server_premium()));

create policy authenticated_read_questions on public.questions
  for select to authenticated
  using (
    ((validation_status = 'validated') and ((coalesce(access_level, 'free') <> 'premium') or private.has_server_premium()))
    or (select is_app_admin())
  );

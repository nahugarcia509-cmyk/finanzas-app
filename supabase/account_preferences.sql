-- Ejecutar una vez en SQL Editor en proyectos existentes.
create table if not exists public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_account_id uuid references public.accounts(id) on delete set null
);
alter table public.account_preferences enable row level security;
drop policy if exists "account preferences own" on public.account_preferences;
create policy "account preferences own" on public.account_preferences
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and (
      primary_account_id is null or exists (
        select 1 from public.accounts
        where accounts.id = primary_account_id and accounts.user_id = auth.uid()
      )
    )
  );
grant select, insert, update, delete on public.account_preferences to authenticated;

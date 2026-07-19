create extension if not exists "pgcrypto";
create table if not exists public.accounts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,currency text not null default 'ARS',initial_balance numeric(14,2) not null default 0,created_at timestamptz default now());
create table if not exists public.categories(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,name text not null,type text not null check(type in('income','expense','both')),created_at timestamptz default now());
create table if not exists public.transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,date date not null,type text not null check(type in('income','expense','transfer')),description text not null,amount numeric(14,2) not null check(amount>=0),account_id uuid not null references public.accounts(id) on delete restrict,category_id uuid references public.categories(id) on delete set null,notes text,created_at timestamptz default now(),updated_at timestamptz default now());
alter table public.accounts enable row level security;alter table public.categories enable row level security;alter table public.transactions enable row level security;
create policy "accounts own" on public.accounts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "categories own" on public.categories for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "transactions own" on public.transactions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create or replace function public.bootstrap_user() returns void language plpgsql security definer set search_path=public as $$ begin
 if not exists(select 1 from accounts where user_id=auth.uid()) then insert into accounts(user_id,name) values(auth.uid(),'Billetera'),(auth.uid(),'Banco'); end if;
 if not exists(select 1 from categories where user_id=auth.uid()) then insert into categories(user_id,name,type) values(auth.uid(),'Comida','expense'),(auth.uid(),'Transporte','expense'),(auth.uid(),'Servicios','expense'),(auth.uid(),'Salud','expense'),(auth.uid(),'Ocio','expense'),(auth.uid(),'Sueldo','income'),(auth.uid(),'Otros ingresos','income'); end if;
end;$$;
grant execute on function public.bootstrap_user() to authenticated;

-- Compatibilidad con la importación inicial del Excel.
alter table public.transactions add column if not exists import_key text;
create unique index if not exists transactions_user_import_key_unique
  on public.transactions(user_id, import_key)
  where import_key is not null;

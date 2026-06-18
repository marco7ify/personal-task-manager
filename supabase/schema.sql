create table if not exists public.app_store (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, key)
);

alter table public.app_store enable row level security;

drop policy if exists "Users can read their own app store rows." on public.app_store;
create policy "Users can read their own app store rows." on public.app_store
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own app store rows." on public.app_store;
create policy "Users can insert their own app store rows." on public.app_store
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app store rows." on public.app_store;
create policy "Users can update their own app store rows." on public.app_store
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own app store rows." on public.app_store;
create policy "Users can delete their own app store rows." on public.app_store
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_store_set_updated_at on public.app_store;
create trigger app_store_set_updated_at
before update on public.app_store
for each row
execute function public.set_updated_at();

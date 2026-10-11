-- SOS-Vidha: profiles and emergency_contacts with row-level security
-- Apply in Supabase SQL Editor or via Supabase CLI: supabase db push

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone_e164 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  relationship text not null default 'GUARDIAN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_contacts_phone_e164_check check (phone_e164 ~ '^\+?[1-9]\d{7,14}$')
);

create index if not exists emergency_contacts_user_id_idx on public.emergency_contacts (user_id);

alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "emergency_contacts_select_own"
  on public.emergency_contacts for select
  using (auth.uid() = user_id);

create policy "emergency_contacts_insert_own"
  on public.emergency_contacts for insert
  with check (auth.uid() = user_id);

create policy "emergency_contacts_update_own"
  on public.emergency_contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "emergency_contacts_delete_own"
  on public.emergency_contacts for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists emergency_contacts_set_updated_at on public.emergency_contacts;
create trigger emergency_contacts_set_updated_at
  before update on public.emergency_contacts
  for each row execute function public.set_updated_at();

-- MULTI-TENANT SETUP for LeadOS (Fixed with Type Casting)
-- Run this in the Supabase SQL Editor

-- 1. PROFILES Table
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  company_name text,
  target_icp text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS for Profiles
alter table public.profiles enable row level security;

-- FIX: Explicitly cast to uuid to avoid "operator does not exist: uuid = text" error
-- if the column happens to be text in a legacy setup.
-- FIX: Handle potential UUID vs Text mismatch in existing tables
-- We cast both sides to text to be safe, or cast auth.uid() to uuid if the column is uuid. 
-- The safest universal way if we are unsure of the column type is casting to text for comparison.

create policy "Users can view own profile" 
on public.profiles for select 
using (auth.uid()::text = id::text);

create policy "Users can update own profile" 
on public.profiles for update 
using (auth.uid()::text = id::text);

create policy "Users can insert own profile" 
on public.profiles for insert 
with check (auth.uid()::text = id::text);


-- 2. SEARCH RESULTS Table
create table if not exists public.search_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  session_id text,
  platform text,
  query text,
  lead_data jsonb,
  status text default 'new',
  created_at timestamptz default now()
);

-- RLS for Search Results
alter table public.search_results enable row level security;

create policy "Users can view own results" 
on public.search_results for select 
using (auth.uid()::text = user_id::text);

create policy "Users can insert own results" 
on public.search_results for insert 
with check (auth.uid()::text = user_id::text);

create policy "Users can update own results" 
on public.search_results for update 
using (auth.uid()::text = user_id::text);

create policy "Users can delete own results" 
on public.search_results for delete 
using (auth.uid()::text = user_id::text);


-- 3. INDEXES
create index if not exists idx_search_results_user on public.search_results(user_id);
create index if not exists idx_search_results_created on public.search_results(created_at desc);


-- 4. AUTO-PROFILE TRIGGER
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
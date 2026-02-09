-- DEDICATED TABLE FOR MARIBEL
-- Run this in Supabase SQL Editor

-- 1. Create the dedicated table
create table if not exists public.search_results_maribel (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  session_id text,
  platform text,
  query text,
  lead_data jsonb,
  status text default 'new',
  created_at timestamptz default now()
);

-- 2. Enable RLS (Standard practice even for dedicated tables)
alter table public.search_results_maribel enable row level security;

-- 3. Policies
-- Allow users (Maribel and her team) to see their own data
-- Note: 'auth.uid()::text = user_id::text' is the safe type casting
create policy "Users can view own results" 
on public.search_results_maribel for select 
using (auth.uid()::text = user_id::text);

create policy "Users can insert own results" 
on public.search_results_maribel for insert 
with check (auth.uid()::text = user_id::text);

create policy "Users can update own results" 
on public.search_results_maribel for update 
using (auth.uid()::text = user_id::text);

create policy "Users can delete own results" 
on public.search_results_maribel for delete 
using (auth.uid()::text = user_id::text);

-- 4. Indexes
create index if not exists idx_maribel_results_user on public.search_results_maribel(user_id);
create index if not exists idx_maribel_results_created on public.search_results_maribel(created_at desc);

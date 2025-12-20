-- Create api_usage_logs table
create table if not exists api_usage_logs (
  id uuid default gen_random_uuid() primary key,
  endpoint text not null,
  model text,
  status text not null, -- 'success', 'error'
  metadata jsonb, -- Store extra info like tokens used if available
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table api_usage_logs enable row level security;

-- Policy: Allow all authenticated users to insert logs (since client-side might trigger it)
create policy "Users can insert api logs"
  on api_usage_logs for insert
  to authenticated
  with check (true);

-- Policy: Allow read access (for stats) - initially open to authenticated, can restrict to admin role if you have one
create policy "Users can read api logs"
  on api_usage_logs for select
  to authenticated
  using (true);

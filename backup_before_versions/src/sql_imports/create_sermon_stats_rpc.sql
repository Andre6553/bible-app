-- Create a secure function to fetch sermon counts per user
-- This runs with SECURITY DEFINER to bypass RLS, ensuring global stats are accurate
create or replace function get_global_sermon_counts()
returns table (
  user_id uuid,
  count bigint
) 
security definer
language plpgsql
as $$
begin
  return query
  select s.user_id, count(*)::bigint
  from sermons s
  where s.user_id is not null
  group by s.user_id
  order by count(*) desc;
end;
$$;

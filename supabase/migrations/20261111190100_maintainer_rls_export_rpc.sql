-- Read-only RLS catalog for maintainers (service_role only)
CREATE OR REPLACE FUNCTION public.get_maintainer_rls_export()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    json_agg(
      json_build_object(
        'tablename', tablename,
        'policyname', policyname,
        'cmd', cmd,
        'roles', roles,
        'qual', qual,
        'with_check', with_check
      )
      ORDER BY tablename, policyname
    ),
    '[]'::json
  )
  FROM pg_policies
  WHERE schemaname = 'public';
$$;

REVOKE ALL ON FUNCTION public.get_maintainer_rls_export() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_maintainer_rls_export() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_maintainer_rls_export() TO service_role;

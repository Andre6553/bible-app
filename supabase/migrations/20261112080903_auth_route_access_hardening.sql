-- Close the permissive note-link policy; preserve owner/admin access.
drop policy if exists "Authenticated users can manage note links" on public.note_labels;
drop policy if exists owner_admin_note_labels on public.note_labels;
create policy owner_admin_note_labels on public.note_labels for all to authenticated
using (exists (select 1 from public.verse_notes n where n.id = note_id and (n.user_id = (select auth.uid())::text or public.is_admin_jwt())))
with check (
 exists (select 1 from public.verse_notes n where n.id = note_id and (n.user_id = (select auth.uid())::text or public.is_admin_jwt()))
 and exists (select 1 from public.user_labels l where l.id = label_id and (l.user_id = (select auth.uid())::text or public.is_admin_jwt()))
);
-- A profile owner must not be able to grant themselves administrative privileges.
-- Service-role payment/webhook operations and the existing owner admin retain access.
create or replace function public.prevent_profile_role_escalation() returns trigger
language plpgsql set search_path = public as $$
begin
 if coalesce(auth.role(), '') = 'service_role' or public.is_admin_jwt() then return new; end if;
 if tg_op = 'INSERT' then
   if coalesce(new.subscription_override, '') in ('admin','tester','tester_finger')
      or coalesce(new.subscription_tier, '') in ('admin','tester','tester_finger') then
     raise exception 'Only an administrator can assign staff access' using errcode = '42501';
   end if;
 else
   if (new.subscription_override is distinct from old.subscription_override and coalesce(new.subscription_override, '') in ('admin','tester','tester_finger'))
      or (new.subscription_tier is distinct from old.subscription_tier and coalesce(new.subscription_tier, '') in ('admin','tester','tester_finger')) then
     raise exception 'Only an administrator can assign staff access' using errcode = '42501';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists prevent_profile_role_escalation on public.user_profiles;
create trigger prevent_profile_role_escalation before insert or update on public.user_profiles
for each row execute function public.prevent_profile_role_escalation();

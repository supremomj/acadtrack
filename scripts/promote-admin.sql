-- Run in Supabase SQL Editor only AFTER migration 003 and after you have
-- registered and verified your own account. Replace the placeholder below.
-- This does not use signup order or user-editable metadata to assign roles.
do $$
declare account_id uuid;
begin
 select id into account_id from auth.users
 where lower(email)=lower('REPLACE_WITH_YOUR_VERIFIED_EMAIL') and email_confirmed_at is not null;
 if account_id is null then raise exception 'No verified account found. Replace the email placeholder and verify that account first.';end if;
 insert into public.admin_memberships(user_id) values(account_id) on conflict do nothing;
 insert into public.admin_audit_log(actor_id,target_id,action,details)
 values(account_id,account_id,'Administrator granted through trusted SQL','{}');
end $$;

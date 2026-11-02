-- Run after migrations 001 and 002. No user is an administrator by default.
begin;
create table public.admin_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended boolean not null default false,reason text not null default '',
 updated_by uuid references auth.users(id) on delete set null,updated_at timestamptz not null default now()
);
create table public.announcements (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 1 and 150),
 body text not null check(length(trim(body)) between 1 and 4000),published boolean not null default false,
 author_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.admin_audit_log (
 id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,
 action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.admin_memberships enable row level security;
alter table public.account_access enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_audit_log enable row level security;
create index announcements_recent on public.announcements(updated_at desc);
create index admin_audit_recent on public.admin_audit_log(created_at desc);

-- Identity comes from the verified server session, never user-editable metadata.
create function public.can_access_acadtrack() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.email_confirmed_at is not null)
 and not exists(select 1 from public.account_access a where a.user_id=(select auth.uid()) and a.suspended);
$$;
create function public.is_acadtrack_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.can_access_acadtrack() and exists(select 1 from public.admin_memberships m where m.user_id=(select auth.uid()));
$$;
create function public.workspace_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('allowed',public.can_access_acadtrack(),'is_admin',public.is_acadtrack_admin(),
 'verified',exists(select 1 from auth.users where id=(select auth.uid()) and email_confirmed_at is not null),
 'suspended',exists(select 1 from public.account_access where user_id=(select auth.uid()) and suspended));
$$;
revoke all on function public.can_access_acadtrack(),public.is_acadtrack_admin(),public.workspace_access() from public,anon,authenticated;
grant execute on function public.can_access_acadtrack(),public.is_acadtrack_admin(),public.workspace_access() to authenticated;

create policy own_membership on public.admin_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy own_access_status on public.account_access for select to authenticated using(user_id=(select auth.uid()));
create policy published_announcements on public.announcements for select to authenticated using(published and (select public.can_access_acadtrack()));
-- All writes to role, suspension, audit, and announcement records go through
-- checked RPCs or trusted SQL. There are intentionally no client write policies.
revoke all on public.admin_memberships,public.account_access,public.announcements,public.admin_audit_log from anon,authenticated;
grant select on public.admin_memberships,public.account_access,public.announcements to authenticated;

-- Restrictive policies AND with existing owner policies, including direct REST
-- access. Administrators still cannot read other students' private coursework.
do $$ declare t text;begin
 foreach t in array array['user_profiles','user_preferences','subjects','tasks','subtasks','task_attachments','class_schedules','calendar_events','study_sessions','grade_categories','grades','notifications','reminder_schedules','activity_history','push_subscriptions','reminder_deliveries','academic_snapshots','weekly_reviews'] loop
  execute format('create policy active_verified_account on public.%I as restrictive for all to authenticated using ((select public.can_access_acadtrack())) with check ((select public.can_access_acadtrack()))',t);
 end loop;
end $$;
create policy active_verified_storage on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'attachments' or (select public.can_access_acadtrack()))
 with check(bucket_id<>'attachments' or (select public.can_access_acadtrack()));

create function public.admin_overview(p_search text default '',p_page int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare accounts jsonb;total int;stats jsonb;audit jsonb;posts jsonb;begin
 if not public.is_acadtrack_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_page<0 or p_page>100000 or length(p_search)>200 then raise exception 'Invalid search or page';end if;
 select count(*) into total from auth.users u left join public.user_preferences p on p.user_id=u.id where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%';
 select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into accounts from (
  select u.id,u.email,p.display_name,u.created_at,u.last_sign_in_at,u.email_confirmed_at,
  exists(select 1 from public.admin_memberships where user_id=u.id) as is_admin,
  coalesce(a.suspended,false) as suspended,coalesce(a.reason,'') as suspension_reason
  from auth.users u left join public.user_preferences p on p.user_id=u.id left join public.account_access a on a.user_id=u.id
  where coalesce(u.email,'') ilike '%'||p_search||'%' or p.display_name ilike '%'||p_search||'%'
  order by u.created_at desc,u.id limit 25 offset p_page*25) x;
 select jsonb_build_object('users',(select count(*) from auth.users),'verified',(select count(*) from auth.users where email_confirmed_at is not null),
  'suspended',(select count(*) from public.account_access where suspended),'admins',(select count(*) from public.admin_memberships),
  'tasks',(select count(*) from public.tasks),'completed_tasks',(select count(*) from public.tasks where status='Completed'),
  'subjects',(select count(*) from public.subjects),'study_minutes',(select coalesce(sum(actual_minutes),0) from public.study_sessions where status='Completed')) into stats;
 select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into audit from (
  select l.id,l.action,l.details,l.created_at,u.email as actor_email,t.email as target_email
  from public.admin_audit_log l left join auth.users u on u.id=l.actor_id left join auth.users t on t.id=l.target_id order by l.created_at desc,l.id limit 100) x;
 select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into posts from (select id,title,body,published,created_at,updated_at from public.announcements order by updated_at desc limit 100) x;
 return jsonb_build_object('accounts',accounts,'total',total,'stats',stats,'audit',audit,'announcements',posts,'page',p_page);
end $$;
create function public.admin_set_suspension(p_user_id uuid,p_suspended boolean,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_acadtrack_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_user_id is null or p_suspended is null or p_reason is null or length(p_reason)>500 then raise exception 'Invalid account change';end if;
 if p_user_id=(select auth.uid()) or exists(select 1 from public.admin_memberships where user_id=p_user_id) then raise exception 'Administrator accounts cannot be suspended here';end if;
 if p_suspended and length(trim(p_reason))<3 then raise exception 'A suspension reason is required';end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Account not found';end if;
 insert into public.account_access(user_id,suspended,reason,updated_by) values(p_user_id,p_suspended,trim(p_reason),(select auth.uid()))
 on conflict(user_id) do update set suspended=excluded.suspended,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now();
 insert into public.admin_audit_log(actor_id,target_id,action,details) values((select auth.uid()),p_user_id,case when p_suspended then 'Account suspended' else 'Account restored' end,jsonb_build_object('reason',trim(p_reason)));
end $$;
create function public.admin_save_announcement(p_id uuid,p_title text,p_body text,p_published boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare post_id uuid;begin
 if not public.is_acadtrack_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_title is null or p_body is null or p_published is null or length(trim(p_title)) not between 1 and 150 or length(trim(p_body)) not between 1 and 4000 then raise exception 'Provide a title and announcement text';end if;
 post_id=coalesce(p_id,gen_random_uuid());
 insert into public.announcements(id,title,body,published,author_id) values(post_id,trim(p_title),trim(p_body),p_published,(select auth.uid()))
 on conflict(id) do update set title=excluded.title,body=excluded.body,published=excluded.published,updated_at=now();
 insert into public.admin_audit_log(actor_id,action,details) values((select auth.uid()),case when p_published then 'Announcement published' else 'Announcement saved as draft' end,jsonb_build_object('announcement_id',post_id,'title',trim(p_title)));
 return post_id;
end $$;
create function public.admin_delete_announcement(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare post_title text;begin
 if not public.is_acadtrack_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 delete from public.announcements where id=p_id returning title into post_title;
 if found then insert into public.admin_audit_log(actor_id,action,details) values((select auth.uid()),'Announcement deleted',jsonb_build_object('announcement_id',p_id,'title',post_title));end if;
end $$;
revoke all on function public.admin_overview(text,int),public.admin_set_suspension(uuid,boolean,text),public.admin_save_announcement(uuid,text,text,boolean),public.admin_delete_announcement(uuid) from public,anon,authenticated;
grant execute on function public.admin_overview(text,int),public.admin_set_suspension(uuid,boolean,text),public.admin_save_announcement(uuid,text,text,boolean),public.admin_delete_announcement(uuid) to authenticated;
-- No service-role key is needed for these guarded administration RPCs.
commit;

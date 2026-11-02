-- Apply once in a new Supabase project. All ownership references are composite
-- so a valid foreign UUID can never reference another student's records.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create table public.user_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Student', created_at timestamptz not null default now()
);
create table public.user_preferences (
 id uuid primary key references auth.users(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 display_name text not null default 'Student', timezone text not null default 'Asia/Manila',
 theme text not null default 'light' check(theme in ('light','dark','system')),
 reminder_hours double precision[] not null default '{168,72,24,6,1}',
 browser_notifications boolean not null default false, email_notifications boolean not null default false,
 study_days int[] not null default '{1,2,3,4,5}', study_start text not null default '17:00', study_end text not null default '21:00',
 session_minutes int not null default 25 check(session_minutes between 5 and 180),
 break_minutes int not null default 5 check(break_minutes between 0 and 60),
 daily_hours numeric not null default 3 check(daily_hours between .25 and 16),
 target_grade numeric not null default 90 check(target_grade between 0 and 100),
 grading_scale text not null default '90–100 Excellent · 80–89 Very good · 70–79 Good · below 70 Needs attention',
 week_start int not null default 1 check(week_start in (0,1)),
 time_format text not null default '12h' check(time_format in ('12h','24h')),
 date_format text not null default 'medium' check(date_format in ('medium','short')),
 default_priority text not null default 'Auto' check(default_priority in ('Auto','Critical','High','Medium','Low')),
 check(id=user_id), check(study_start<study_end)
);
create table public.subjects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 200), code text not null default '', instructor text not null default '',
 semester text not null default '', academic_year text not null default '',color text not null default '#7562dc' check(color ~ '^#[a-fA-F0-9]{6}$'),
 notes text not null default '',archived boolean not null default false,unique(id,user_id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid,title text not null check(length(title) between 1 and 200),description text not null default '',
 category text not null default 'Assignment' check(category in ('Assignment','Quiz','Exam','Project','Research','Presentation','Other')),
 assigned_at timestamptz not null default now(),due_at timestamptz not null,target_at timestamptz,
 estimated_minutes int not null default 60 check(estimated_minutes between 1 and 100000),difficulty int not null default 3 check(difficulty between 1 and 5),
 priority text not null default 'Auto' check(priority in ('Auto','Critical','High','Medium','Low')),
 status text not null default 'Not Started' check(status in ('Not Started','In Progress','For Review','Completed')),
 progress numeric not null default 0 check(progress between 0 and 100),auto_progress boolean not null default false,notes text not null default '',
 completed_at timestamptz,created_at timestamptz not null default now(),unique(id,user_id),
 foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade,
 check(target_at is null or target_at<=due_at)
);
create table public.subtasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,title text not null check(length(title) between 1 and 200),completed boolean not null default false,
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.task_attachments (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,name text not null,path text not null unique,size bigint not null check(size between 0 and 10485760),mime_type text not null,
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
 check(split_part(path,'/',1)=user_id::text)
);
create table public.class_schedules (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid not null,weekday int not null check(weekday between 0 and 6),start_time text not null,end_time text not null,location text not null default '',
 foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade,check(end_time>start_time)
);
create table public.calendar_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid,title text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 kind text not null default 'Personal' check(kind in ('Personal','Exam','Project','Class')),notes text not null default '',
 foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade,check(ends_at>starts_at)
);
create table public.study_sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid,title text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null default 'Planned' check(status in ('Suggested','Planned','Completed','Rejected')),
 actual_minutes numeric not null default 0 check(actual_minutes between 0 and 10000),kind text not null default 'Study' check(kind in ('Study','Focus')),
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete set null (task_id),check(ends_at>starts_at),
 exclude using gist (user_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where (status='Planned')
);
create table public.grade_categories (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid not null,name text not null,weight numeric not null check(weight>0 and weight<=100),unique(id,user_id,subject_id),
 foreign key(subject_id,user_id) references public.subjects(id,user_id) on delete cascade
);
create table public.grades (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid not null,category_id uuid not null,title text not null,score numeric not null check(score>=0),maximum numeric not null check(maximum>0),assessed_at timestamptz not null default now(),check(score<=maximum),
 foreign key(category_id,user_id,subject_id) references public.grade_categories(id,user_id,subject_id) on delete cascade
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid,title text not null,body text not null default '',created_at timestamptz not null default now(),read boolean not null default false,
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.reminder_schedules (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid not null,deadline timestamptz not null,hours_before double precision not null,notification_id uuid references public.notifications(id) on delete cascade,
 created_at timestamptz not null default now(),unique(task_id,deadline,hours_before),
 foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.activity_history (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,created_at timestamptz not null default now()
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null,subscription jsonb not null,unique(user_id,endpoint),
 check(endpoint ~ '^https://(fcm\.googleapis\.com|([a-zA-Z0-9-]+\.)?push\.services\.mozilla\.com|web\.push\.apple\.com|[a-zA-Z0-9.-]+\.notify\.windows\.com)(/|$)'),
 check(subscription->>'endpoint'=endpoint)
);
create table public.reminder_deliveries (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 notification_id uuid not null references public.notifications(id) on delete cascade,
 channel text not null check(channel in ('email','push')),destination text not null,payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),
 attempts int not null default 0,available_at timestamptz not null default now(),last_error text,
 unique(notification_id,channel,destination)
);
-- Every user-owned table is isolated by RLS. Server routes do NOT use the service role.
do $$ declare t text; begin
 foreach t in array array['user_preferences','subjects','tasks','subtasks','task_attachments','class_schedules','calendar_events','study_sessions','grade_categories','grades','notifications','reminder_schedules','activity_history','push_subscriptions','reminder_deliveries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  if t not in ('reminder_schedules','reminder_deliveries') then
   execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
   execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
   execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
  end if;
  execute format('create index on public.%I(user_id)',t);
 end loop;
end $$;
alter table public.user_profiles enable row level security;
create policy own_profile on public.user_profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create index tasks_user_deadline on public.tasks(user_id,due_at) where status<>'Completed';
create index subtasks_task on public.subtasks(task_id);
create index sessions_user_start on public.study_sessions(user_id,starts_at);
create index grades_category on public.grades(category_id);
create index deliveries_queue on public.reminder_deliveries(available_at) where status in ('pending','sending');
create index activity_recent on public.activity_history(user_id,created_at desc);
-- Derived status never marks completed tasks overdue and remains correct between cron runs.
create view public.task_status with(security_invoker=true) as
 select t.*,case when status<>'Completed' and due_at<now() then 'Overdue' else status end as effective_status,
 case when priority<>'Auto' then priority when due_at<=now()+interval '24 hours' then 'Critical' when due_at<=now()+interval '3 days' then 'High' when due_at<=now()+interval '7 days' then 'Medium' else 'Low' end as effective_priority
 from public.tasks t;
create function public.new_user_profile() returns trigger language plpgsql security definer set search_path='' as $$
 begin insert into public.user_profiles(id) values(new.id);insert into public.user_preferences(id,user_id) values(new.id,new.id);return new;end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user_profile();
create function public.task_activity() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if tg_op='DELETE' then
  if exists(select 1 from auth.users where id=old.user_id) then insert into public.activity_history(user_id,title) values(old.user_id,'Deleted task: '||old.title);end if;
  return old;
 end if;
 if new.status='Completed' then new.completed_at=coalesce(new.completed_at,now());new.progress=100;else new.completed_at=null;end if;
 if tg_op='INSERT' then insert into public.activity_history(user_id,title) values(new.user_id,'Added task: '||new.title);
 elsif new is distinct from old then
 insert into public.activity_history(user_id,title) values(new.user_id,
 case when new.status='Completed' and old.status<>'Completed' then 'Completed: ' when new.due_at<>old.due_at then 'Changed deadline: ' else 'Updated task: ' end||new.title);
 end if;return new;end $$;
create trigger task_history before insert or update or delete on public.tasks for each row execute function public.task_activity();
create function public.sync_subtask_progress() returns trigger language plpgsql security definer set search_path='' as $$
 declare tid uuid; begin tid=case when tg_op='DELETE' then old.task_id else new.task_id end;
 update public.tasks set progress=(select coalesce(round(100.0*count(*) filter(where completed)/nullif(count(*),0)),0) from public.subtasks where task_id=tid) where id=tid and auto_progress and status<>'Completed';return null;end $$;
create trigger subtask_progress after insert or update or delete on public.subtasks for each row execute function public.sync_subtask_progress();
create function public.validate_category_weight() returns trigger language plpgsql set search_path='' as $$
 begin perform 1 from public.subjects where id=new.subject_id and user_id=new.user_id for update;
 if (select coalesce(sum(weight),0) from public.grade_categories where subject_id=new.subject_id and user_id=new.user_id and id<>new.id)+new.weight>100 then raise exception 'Category weights exceed 100%%';end if;return new;end $$;
create trigger grade_weight_limit before insert or update on public.grade_categories for each row execute function public.validate_category_weight();
create function public.check_session_conflicts() returns trigger language plpgsql set search_path='' as $$
 declare zone text;local_start timestamp;local_end timestamp;begin
 if new.status<>'Planned' then return new;end if;
 if exists(select 1 from public.calendar_events where user_id=new.user_id and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Study session overlaps an event';end if;
 select timezone into zone from public.user_preferences where user_id=new.user_id;zone=coalesce(zone,'Asia/Manila');local_start=new.starts_at at time zone zone;local_end=new.ends_at at time zone zone;
 if local_start::date<>local_end::date then raise exception 'Study sessions must start and end on the same local day';end if;
 if exists(select 1 from public.class_schedules where user_id=new.user_id and weekday=extract(dow from local_start) and start_time::time<local_end::time and end_time::time>local_start::time) then raise exception 'Study session overlaps a class';end if;
 return new;end $$;
create trigger session_conflicts before insert or update on public.study_sessions for each row execute function public.check_session_conflicts();
-- A transactional outbox: unique task/deadline/interval prevents duplicate in-app reminders.
create function public.enqueue_reminders() returns int language plpgsql security definer set search_path='' as $$
 declare r record;rid uuid;nid uuid;counted int:=0;sub record;email_address text;begin
 for r in select t.id,t.user_id,t.title,t.due_at,p.timezone,p.email_notifications,p.browser_notifications,h.hours_before
  from public.tasks t join public.user_preferences p on p.user_id=t.user_id
  cross join lateral unnest(p.reminder_hours) h(hours_before)
  where t.status<>'Completed' and t.due_at>now() and t.due_at-(h.hours_before*interval '1 hour')<=now()
  -- Skip old intervals on newly-created tasks. Allow scheduler outages to catch up.
  and t.due_at-(h.hours_before*interval '1 hour')>=t.created_at-interval '10 minutes'
 loop
  rid=null;insert into public.reminder_schedules(user_id,task_id,deadline,hours_before) values(r.user_id,r.id,r.due_at,r.hours_before) on conflict do nothing returning id into rid;
  if rid is null then continue;end if;
  insert into public.notifications(user_id,task_id,title,body) values(r.user_id,r.id,'Coming up: '||r.title,'Due '||to_char(r.due_at at time zone r.timezone,'Mon DD, HH24:MI')||' ('||r.timezone||'). Make a little time for your next step.') returning id into nid;
  update public.reminder_schedules set notification_id=nid where id=rid;
  if r.email_notifications then
   select email into email_address from auth.users where id=r.user_id;
   if email_address is not null then insert into public.reminder_deliveries(user_id,notification_id,channel,destination,payload) values(r.user_id,nid,'email',email_address,jsonb_build_object('title','Coming up: '||r.title,'body','Your task is due '||to_char(r.due_at at time zone r.timezone,'Mon DD, HH24:MI')||' ('||r.timezone||').'));end if;
  end if;
  if r.browser_notifications then for sub in select * from public.push_subscriptions where user_id=r.user_id loop
   insert into public.reminder_deliveries(user_id,notification_id,channel,destination,payload) values(r.user_id,nid,'push',sub.endpoint,jsonb_build_object('subscription',sub.subscription,'title','Coming up: '||r.title,'body','Your task deadline is approaching. Open AcadTrack to review.','id',nid));
  end loop;end if;
  counted=counted+1;
 end loop;
 -- Cancel pending delivery when a task is finished, deleted, or rescheduled.
 update public.reminder_deliveries d set status='cancelled' where d.status in ('pending','sending') and not exists(
 select 1 from public.reminder_schedules rs join public.tasks t on t.id=rs.task_id join public.user_preferences p on p.user_id=t.user_id
 where rs.notification_id=d.notification_id and t.status<>'Completed' and t.due_at=rs.deadline and ((d.channel='push' and p.browser_notifications) or (d.channel='email' and p.email_notifications)));
 return counted;end $$;
create function public.claim_reminders() returns setof public.reminder_deliveries language sql security definer set search_path='' as $$
 update public.reminder_deliveries set status='sending',attempts=attempts+1,available_at=now()+interval '5 minutes'
 where id in (select id from public.reminder_deliveries where status in ('pending','sending') and available_at<=now() and attempts<5 order by available_at for update skip locked limit 20) returning *;
$$;
revoke all on function public.enqueue_reminders() from public,anon,authenticated;
revoke all on function public.claim_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_reminders() to service_role;
grant execute on function public.claim_reminders() to service_role;
revoke all on function public.new_user_profile() from public,anon,authenticated;
revoke all on function public.task_activity() from public,anon,authenticated;
revoke all on function public.sync_subtask_progress() from public,anon,authenticated;
-- Private attachments: only the owner can upload, read or delete objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('attachments','attachments',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create policy attachment_read on storage.objects for select to authenticated using(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy attachment_insert on storage.objects for insert to authenticated with check(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy attachment_delete on storage.objects for delete to authenticated using(bucket_id='attachments' and (storage.foldername(name))[1]=(select auth.uid())::text);

create table public.academic_snapshots (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,completed int not null,overdue int not null,pending int not null,study_minutes numeric not null,
 unique(user_id,day)
);
create table public.weekly_reviews (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 period_start date not null,period_end date not null,completed_count int not null,unfinished_count int not null,
 upcoming_count int not null,study_minutes numeric not null,attention_subjects uuid[] not null,suggested_tasks uuid[] not null,
 created_at timestamptz not null default now(),unique(user_id,period_start)
);
alter table public.academic_snapshots enable row level security;
alter table public.weekly_reviews enable row level security;
create policy own_snapshot on public.academic_snapshots for select to authenticated using ((select auth.uid())=user_id);
create policy own_review on public.weekly_reviews for select to authenticated using ((select auth.uid())=user_id);
create index snapshots_user_day on public.academic_snapshots(user_id,day);
create index reviews_user_start on public.weekly_reviews(user_id,period_start);
create function public.capture_academic_summaries() returns int language plpgsql security definer set search_path='' as $$
declare p record;today date;week_end date;week_start date;start_at timestamptz;end_at timestamptz;
 done int;unfinished int;upcoming int;studied numeric;review_id uuid;attention uuid[];suggested uuid[];counted int:=0;
begin
 for p in select * from public.user_preferences loop
  today=(now() at time zone p.timezone)::date;
  insert into public.academic_snapshots(user_id,day,completed,overdue,pending,study_minutes)
  select p.user_id,today,count(*) filter(where status='Completed'),count(*) filter(where status<>'Completed' and due_at<now()),count(*) filter(where status<>'Completed'),
  (select coalesce(sum(actual_minutes),0) from public.study_sessions where user_id=p.user_id and status='Completed' and (starts_at at time zone p.timezone)::date=today)
  from public.tasks where user_id=p.user_id
  on conflict(user_id,day) do update set completed=excluded.completed,overdue=excluded.overdue,pending=excluded.pending,study_minutes=excluded.study_minutes;
  week_end=today-((extract(dow from today)::int-p.week_start+7)%7);week_start=week_end-7;
  if exists(select 1 from public.weekly_reviews where user_id=p.user_id and period_start=week_start) then continue;end if;
  start_at=week_start::timestamp at time zone p.timezone;end_at=week_end::timestamp at time zone p.timezone;
  select count(*) filter(where status='Completed' and completed_at>=start_at and completed_at<end_at),count(*) filter(where status<>'Completed'),count(*) filter(where status<>'Completed' and due_at>=end_at and due_at<end_at+interval '7 days')
  into done,unfinished,upcoming from public.tasks where user_id=p.user_id;
  select coalesce(sum(actual_minutes),0) into studied from public.study_sessions where user_id=p.user_id and status='Completed' and starts_at>=start_at and starts_at<end_at;
  select coalesce(array_agg(distinct subject_id) filter(where subject_id is not null),'{}') into attention from public.tasks where user_id=p.user_id and status<>'Completed' and (due_at<now() or estimated_minutes*(1-progress/100)>greatest(0,extract(epoch from due_at-now())/86400)*p.daily_hours*60);
  select coalesce(array_agg(id),'{}') into suggested from (select id from public.tasks where user_id=p.user_id and status<>'Completed' order by
   (case when due_at<now() then 200 when priority='Critical' or due_at<now()+interval '1 day' then 100 when priority='High' or due_at<now()+interval '3 days' then 65 else 30 end +difficulty*3+estimated_minutes*(1-progress/100)/greatest(1,extract(epoch from due_at-now())/60)*100) desc limit 5) ordered;
  review_id=null;
  insert into public.weekly_reviews(user_id,period_start,period_end,completed_count,unfinished_count,upcoming_count,study_minutes,attention_subjects,suggested_tasks)
  values(p.user_id,week_start,week_end,done,unfinished,upcoming,studied,attention,suggested) on conflict do nothing returning id into review_id;
  if review_id is not null then
   insert into public.notifications(user_id,title,body) values(p.user_id,'Your weekly check-in is ready',done||' tasks completed, '||round(studied/60,1)||' hours studied. '||unfinished||' unfinished tasks and '||upcoming||' upcoming deadlines. Open Weekly review to plan your next steps.');counted=counted+1;
  end if;
 end loop;
 return counted;
end $$;
revoke all on function public.capture_academic_summaries() from public,anon,authenticated;
grant execute on function public.capture_academic_summaries() to service_role;
-- Validate preferences at the data boundary, including direct Supabase REST writes.
create function public.validate_preferences() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone';end if;
 if cardinality(new.reminder_hours)>20 or exists(select 1 from unnest(new.reminder_hours) h where h<=0 or h>8760 or h='NaN'::float8) then raise exception 'Invalid reminder intervals';end if;
 if exists(select 1 from unnest(new.study_days) d where d<0 or d>6) then raise exception 'Invalid study days';end if;
 if new.study_start!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.study_end!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid study window';end if;
 return new;
end $$;
create trigger preferences_validation before insert or update on public.user_preferences for each row execute function public.validate_preferences();
-- Serialize calendar writes per owner so cross-table conflict checks are reliable.
create function public.validate_calendar_event() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.user_preferences where user_id=new.user_id for update;
 if exists(select 1 from public.study_sessions where user_id=new.user_id and status='Planned' and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)'))
 or exists(select 1 from public.calendar_events where user_id=new.user_id and id<>new.id and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Event overlaps another scheduled activity';end if;
 return new;
end $$;
create trigger calendar_conflicts before insert or update on public.calendar_events for each row execute function public.validate_calendar_event();
create function public.lock_schedule_owner() returns trigger language plpgsql set search_path='' as $$begin perform 1 from public.user_preferences where user_id=new.user_id for update;return new;end $$;
create trigger a_session_lock before insert or update on public.study_sessions for each row execute function public.lock_schedule_owner();

-- Daily usage by action.
select
  date_trunc('day', created_at) as day,
  action,
  count(*) as events,
  sum(quantity) as quantity
from public.usage_events
group by 1, 2
order by 1 desc, 4 desc;

-- Top users by AI and media usage in the last 24 hours.
select
  user_id,
  action,
  sum(quantity) as quantity
from public.usage_events
where created_at >= now() - interval '24 hours'
  and user_id is not null
group by 1, 2
order by 3 desc
limit 50;

-- Signup email rate-limit events in the last 24 hours.
select
  subject_key,
  count(*) as events,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from public.usage_events
where action = 'signup_email'
  and created_at >= now() - interval '24 hours'
group by 1
order by events desc
limit 50;

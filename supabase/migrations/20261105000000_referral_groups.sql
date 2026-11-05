-- ─────────────────────────────────────────────────────────────────────────────
-- Referral groups — one referral code and one voucher limit per group.
--
-- Each group (for example MarComm or Sales) has its own code, printed in that
-- group's invitation email, and its own limit. The form rejects any other code.
-- A group stops at its own number and the other groups carry on. Each voucher
-- belongs to one group, so groups can be loaded in stages.
--
-- This file holds structure only. Real referral codes and limits are entered by
-- hand in Supabase (see docs/RUNBOOK.md), because this repository is public.
--
-- Run once in the Supabase SQL Editor, BEFORE merging the app change. It only
-- adds things: `voucher_capacity` and every existing column are left alone, so
-- the app that is live today keeps working after this has run.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.referral_groups (
  group_name     text primary key check (char_length(group_name) between 1 and 60),
  -- Stored the way the app normalises what people type: capitals, no spaces.
  referral_code  text not null unique
                   check (referral_code = upper(referral_code)
                          and referral_code !~ '\s'
                          and char_length(referral_code) between 1 and 50),
  voucher_limit  integer not null check (voucher_limit >= 0),
  -- false = the form rejects this code. People already in keep their place.
  active         boolean not null default true
);

alter table public.referral_groups enable row level security;
revoke all on table public.referral_groups from anon, authenticated;
grant select, insert, update, delete on table public.referral_groups to service_role;

-- Which group a voucher belongs to. Empty until the group is loaded; a code with
-- no group is never handed out.
alter table public.vouchers
  add column group_name text references public.referral_groups (group_name) on update cascade;

-- Same people as before, now showing which code each one entered with.
create or replace view public.voucher_people
with (security_invoker = true) as
select id, submitted_at, email, phone, status, voucher_code, referral_code
from (
  select s.id, s.submitted_at, s.email, s.phone, s.status, s.voucher_code, s.referral_code,
         row_number() over (partition by s.email order by s.submitted_at, s.id) as by_email,
         row_number() over (partition by s.phone order by s.submitted_at, s.id) as by_phone
  from public.submissions s
  where s.status <> 'REJECTED'
) ranked
where by_email = 1 and by_phone = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- One row per group. A group is full when claimed >= places, where places is
-- the lower of its limit and its codes, so the form never promises a voucher
-- that is not there. A code given to an entry later marked REJECTED is used up,
-- so it no longer counts as loaded.
-- ─────────────────────────────────────────────────────────────────────────────
create view public.group_capacity
with (security_invoker = true) as
select
  g.group_name,
  g.active,
  g.voucher_limit,
  coalesce(c.codes_loaded, 0)::int                         as codes_loaded,
  coalesce(p.claimed, 0)::int                              as claimed,
  least(g.voucher_limit, coalesce(c.codes_loaded, 0))::int as places
from public.referral_groups g
left join (
  select v.group_name, count(*) as codes_loaded
  from public.vouchers v
  left join public.submissions s on s.id = v.assigned_to
  where s.status is distinct from 'REJECTED'
  group by v.group_name
) c on c.group_name = g.group_name
left join (
  select vp.referral_code, count(*) as claimed
  from public.voucher_people vp
  group by vp.referral_code
) p on p.referral_code = g.referral_code
order by g.group_name;

revoke all on table public.group_capacity from anon, authenticated;
grant select on table public.group_capacity to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- The form's way in. Checks the code and the group's limit and stores the entry
-- in one step, so two people cannot both take a group's last place.
--
-- Returns ENTERED, INVALID_CODE or FULL. Only ENTERED can store a row, and a
-- person who already entered keeps their place without a second row.
-- ─────────────────────────────────────────────────────────────────────────────
create function public.enter_campaign(
  p_referral_code     text,
  p_full_name         text,
  p_phone             text,
  p_email             text,
  p_company_name      text,
  p_terms_accepted_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  grp     referral_groups%rowtype;
  is_full boolean;
begin
  -- Locks this group's row: entries to one group queue up here, while entries
  -- to other groups go straight through.
  select * into grp
  from referral_groups
  where referral_code = p_referral_code and active
  for update;

  if not found then
    return 'INVALID_CODE';
  end if;

  select c.claimed >= c.places into is_full
  from group_capacity c
  where c.group_name = grp.group_name;

  if is_full then
    if exists (
      select 1 from submissions s
      where s.email = p_email and s.phone = p_phone and s.status <> 'REJECTED'
    ) then
      return 'ENTERED';
    end if;
    return 'FULL';
  end if;

  insert into submissions (referral_code, full_name, phone, email, company_name, terms_accepted_at)
  values (p_referral_code, p_full_name, p_phone, p_email, p_company_name, p_terms_accepted_at);

  return 'ENTERED';
end;
$$;

revoke all on function public.enter_campaign(text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enter_campaign(text, text, text, text, text, timestamptz)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Same as before, but within each group: a group's waiting people get that
-- group's next free codes, in list order. Safe to re-run. A retired group's
-- people still get their codes. Codes with no group are left alone.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.assign_pending_vouchers()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  assigned integer;
begin
  -- Serialise runs so two people clicking at once cannot hand out a row twice.
  lock table public.vouchers in share row exclusive mode;

  with waiting as (
    select p.id, g.group_name,
           row_number() over (partition by g.group_name order by p.submitted_at, p.id) as rn
    from voucher_people p
    join referral_groups g on g.referral_code = p.referral_code
    where p.status = 'PENDING'
      and p.voucher_code is null
  ),
  free as (
    select v.code, v.group_name,
           row_number() over (partition by v.group_name order by v.seq) as rn
    from vouchers v
    where v.assigned_to is null
      and v.group_name is not null
  ),
  pairs as (
    select w.id, f.code from waiting w join free f using (group_name, rn)
  ),
  mark_vouchers as (
    update vouchers v
       set assigned_to = p.id, assigned_at = now()
      from pairs p
     where v.code = p.code
    returning v.code
  )
  update submissions s
     set voucher_code = p.code
    from pairs p
   where s.id = p.id;

  get diagnostics assigned = row_count;
  return assigned;
end;
$$;

-- The send list, now also showing each person's group.
create or replace view public.voucher_send_list
with (security_invoker = true) as
select
  s.full_name,
  s.email,
  s.voucher_code,
  v.expires_at as voucher_expires,
  v.seq        as list_row,
  s.submitted_at,
  s.id,
  v.group_name
from public.submissions s
join public.vouchers v on v.code = s.voucher_code
where s.status = 'PENDING'
order by v.seq;

-- Make the new table, view and function visible to the app straight away.
notify pgrst, 'reload schema';

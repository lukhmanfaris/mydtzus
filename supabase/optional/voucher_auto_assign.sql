-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL — voucher option 1: "the app assigns, the team sends".
--
-- Not a migration. Run this once in the Supabase SQL Editor ONLY if you choose
-- to load ZUS's voucher codes into the database. If the team matches vouchers
-- by hand (option 2), ignore this file: fill submissions.voucher_code yourself.
--
-- Nothing in the app or the screens changes either way.
--
-- Usage, after running this file:
--   1. Load codes:   insert into vouchers (code, expires_at) values ('ZUS-...', '2026-12-31'), ...;
--   2. Review:       mark entries to exclude as status = 'REJECTED'.
--   3. Assign:       select assign_pending_vouchers();   -- returns how many were assigned
--   4. Export:       select * from submissions_export where status = 'PENDING' and voucher_code is not null;
--   5. After sending from Zoho:
--                    update submissions set status = 'SENT', voucher_sent_at = now()
--                     where status = 'PENDING' and voucher_code is not null;
-- Step 3 is safe to re-run: it only touches entries without a voucher, and
-- stops quietly when the pool runs out.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.vouchers (
  code         text primary key,
  expires_at   date,
  assigned_to  uuid unique references public.submissions (id),
  assigned_at  timestamptz
);

alter table public.vouchers enable row level security;
revoke all on table public.vouchers from anon, authenticated;

-- One voucher per person: among PENDING entries without a voucher, only the
-- earliest per email AND per phone is eligible, and never anyone whose email
-- or phone already holds a voucher.
create or replace function public.assign_pending_vouchers()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  assigned integer;
begin
  -- Serialise concurrent runs so two editors cannot hand out the same code.
  lock table public.vouchers in share row exclusive mode;

  with pending as (
    select s.id, s.email, s.phone, s.submitted_at
    from submissions s
    where s.status = 'PENDING'
      and s.voucher_code is null
      and not exists (
        select 1 from submissions o
        where o.voucher_code is not null
          and (o.email = s.email or o.phone = s.phone)
      )
  ),
  ranked as (
    select id, submitted_at,
           row_number() over (partition by email order by submitted_at, id) as by_email,
           row_number() over (partition by phone order by submitted_at, id) as by_phone
    from pending
  ),
  eligible as (
    select id, row_number() over (order by submitted_at, id) as rn
    from ranked
    where by_email = 1 and by_phone = 1
  ),
  free as (
    select code, row_number() over (order by code) as rn
    from vouchers
    where assigned_to is null
  ),
  pairs as (
    select e.id, f.code from eligible e join free f using (rn)
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

revoke all on function public.assign_pending_vouchers() from public, anon, authenticated;

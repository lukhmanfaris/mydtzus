-- ─────────────────────────────────────────────────────────────────────────────
-- Vouchers — first come, first served.
--
-- ZUS's codes are loaded into `vouchers` with their row number (`seq`) from
-- the list. Before each Zoho send the team runs `assign_pending_vouchers()`:
-- the earliest waiting entry gets row 1, the next row 2, and so on — rows are
-- used strictly in order, never skipped. One code per person (earliest entry
-- per email and per phone); entries marked REJECTED never get one.
--
-- `voucher_capacity` tells the Worker when every code has a person waiting for
-- it, so the form can show "All vouchers have been claimed" and stop.
--
-- Run once in the Supabase SQL Editor. It fails loudly if a `vouchers` table
-- already exists (e.g. from the old optional script) rather than mixing the two.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.vouchers (
  -- Row number in ZUS's list; codes are handed out in this order.
  seq          integer primary key check (seq > 0),
  code         text not null unique check (char_length(code) between 1 and 100),
  expires_at   date,
  assigned_to  uuid unique references public.submissions (id),
  assigned_at  timestamptz
);

alter table public.vouchers enable row level security;
revoke all on table public.vouchers from anon, authenticated;
grant select, insert, update, delete on table public.vouchers to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- "People": among entries not marked REJECTED, the earliest per email and the
-- earliest per phone. A repeat entry with the same email or phone is not a new
-- person. Shared by the capacity count and the assignment, so they always agree.
-- ─────────────────────────────────────────────────────────────────────────────
create view public.voucher_people
with (security_invoker = true) as
select id, submitted_at, email, phone, status, voucher_code
from (
  select s.id, s.submitted_at, s.email, s.phone, s.status, s.voucher_code,
         row_number() over (partition by s.email order by s.submitted_at, s.id) as by_email,
         row_number() over (partition by s.phone order by s.submitted_at, s.id) as by_phone
  from public.submissions s
  where s.status <> 'REJECTED'
) ranked
where by_email = 1 and by_phone = 1;

revoke all on table public.voucher_people from anon, authenticated;
grant select on table public.voucher_people to service_role;

-- Codes loaded vs people entered. The Worker closes the form when
-- total_codes > 0 and claimed >= total_codes.
create view public.voucher_capacity
with (security_invoker = true) as
select
  (select count(*) from public.vouchers)::int     as total_codes,
  (select count(*) from public.voucher_people)::int as claimed;

revoke all on table public.voucher_capacity from anon, authenticated;
grant select on table public.voucher_capacity to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Assign the next free codes, in list order, to people still waiting, in
-- submission order. Returns how many were assigned. Safe to re-run: it only
-- touches people without a code, and stops quietly when the codes run out.
-- ─────────────────────────────────────────────────────────────────────────────
create function public.assign_pending_vouchers()
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
    select p.id, row_number() over (order by p.submitted_at, p.id) as rn
    from voucher_people p
    where p.status = 'PENDING'
      and p.voucher_code is null
  ),
  free as (
    select v.code, row_number() over (order by v.seq) as rn
    from vouchers v
    where v.assigned_to is null
  ),
  pairs as (
    select w.id, f.code from waiting w join free f using (rn)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- The list to send from Zoho: everyone who has a code and has not been sent
-- one yet. Export as CSV and use it as the Zoho mail-merge list.
-- ─────────────────────────────────────────────────────────────────────────────
create view public.voucher_send_list
with (security_invoker = true) as
select
  s.full_name,
  s.email,
  s.voucher_code,
  v.expires_at as voucher_expires,
  v.seq        as list_row,
  s.submitted_at,
  s.id
from public.submissions s
join public.vouchers v on v.code = s.voucher_code
where s.status = 'PENDING'
order by v.seq;

revoke all on table public.voucher_send_list from anon, authenticated;
grant select on table public.voucher_send_list to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tidy names for the voucher email. Email 03 greets people by the name in the
-- send list, and people type names in any case. The send list now shows First
-- Letter Capital: AHMAD FARHAN becomes Ahmad Farhan. `submissions` keeps each
-- name exactly as typed.
--
-- Run in the Supabase SQL Editor any time before the first batch. The app does
-- not read this view, so the order around a deploy doesn't matter. Safe to run
-- twice.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.voucher_send_list
with (security_invoker = true) as
select
  initcap(s.full_name) as full_name,
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

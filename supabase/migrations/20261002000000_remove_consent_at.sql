-- ─────────────────────────────────────────────────────────────────────────────
-- Remove consent_at. All documents (T&C and data terms) are now agreed with a
-- single "I Agree" before the form, recorded in terms_accepted_at alone.
--
-- Run in two steps so live submissions never fail (see docs/RUNBOOK.md):
--   STEP 1 — before the app change is deployed: make the column optional, so
--            both the old app (still sending it) and the new one (not) work.
--   STEP 2 — after the new app is live: drop the column and rebuild the view.
-- Running the whole file at once after deploy is also fine.
-- ─────────────────────────────────────────────────────────────────────────────

-- STEP 1
alter table public.submissions alter column consent_at drop not null;

-- STEP 2
-- The export view selects consent_at, so it is rebuilt without it.
drop view if exists public.submissions_export;

alter table public.submissions drop column if exists consent_at;

create view public.submissions_export
with (security_invoker = true) as
select
  s.submitted_at,
  s.referral_code,
  s.full_name,
  s.phone,
  s.email,
  s.company_name,
  s.status,
  s.voucher_code,
  s.voucher_sent_at,
  count(*)     over (partition by s.email) as email_count,
  count(*)     over (partition by s.phone) as phone_count,
  row_number() over (partition by s.email order by s.submitted_at, s.id) = 1 as first_by_email,
  row_number() over (partition by s.phone order by s.submitted_at, s.id) = 1 as first_by_phone,
  s.terms_accepted_at,
  s.notes,
  s.id
from public.submissions s;

revoke all on table public.submissions_export from anon, authenticated;
grant select on table public.submissions_export to service_role;

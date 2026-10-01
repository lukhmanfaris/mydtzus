-- ─────────────────────────────────────────────────────────────────────────────
-- ZUS voucher campaign — form submissions
--
-- The app only INSERTs, through the Worker, using the service role key.
-- The team reads and exports from the Supabase dashboard (submissions_export).
-- Voucher codes are filled in later — by hand, or by
-- supabase/optional/voucher_auto_assign.sql if that option is chosen.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.submissions (
  id                 uuid primary key default gen_random_uuid(),

  -- Free text, normalised to uppercase with no spaces by the app.
  referral_code      text not null check (char_length(referral_code) between 1 and 50),
  full_name          text not null check (char_length(full_name) between 2 and 100),
  -- Normalised to 60XXXXXXXXX by the app.
  phone              text not null check (phone ~ '^60[0-9]{8,10}$'),
  -- Lowercased by the app; enforced here so the duplicate check stays exact.
  email              text not null check (email = lower(email) and char_length(email) <= 120),
  company_name       text not null check (char_length(company_name) between 2 and 150),

  terms_accepted_at  timestamptz not null,
  consent_at         timestamptz not null,
  submitted_at       timestamptz not null default now(),

  -- Filled in by the team after submission.
  status             text not null default 'PENDING'
                       check (status in ('PENDING', 'SENT', 'REJECTED')),
  voucher_code       text unique,
  voucher_sent_at    timestamptz,
  notes              text
);

comment on column public.submissions.status is
  'PENDING = waiting for voucher, SENT = voucher emailed, REJECTED = duplicate/invalid';

create index submissions_email_idx        on public.submissions (email);
create index submissions_phone_idx        on public.submissions (phone);
create index submissions_submitted_at_idx on public.submissions (submitted_at);

-- RLS on with no policies: anon and authenticated can do nothing. The service
-- role (the Worker) and the dashboard bypass RLS.
alter table public.submissions enable row level security;
revoke all on table public.submissions from anon, authenticated;

-- The Worker writes with the service role. Granted explicitly so this works
-- when the project has "Automatically expose new tables" turned off.
grant select, insert, update, delete on table public.submissions to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Export view. Duplicates are allowed in; this view flags them so the team
-- can filter before sending vouchers.
--   first_by_email / first_by_phone = this is the earliest entry for that value
--   email_count / phone_count       = how many entries share that value
-- ─────────────────────────────────────────────────────────────────────────────
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
  s.consent_at,
  s.notes,
  s.id
from public.submissions s;

revoke all on table public.submissions_export from anon, authenticated;
grant select on table public.submissions_export to service_role;

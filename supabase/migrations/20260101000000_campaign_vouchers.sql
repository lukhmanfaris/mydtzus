-- Migration: Campaign Voucher Redemption System
-- Recipients, atomic voucher draw, form responses, strict RLS.
--
-- Idempotent: safe to re-run against an existing database.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ───────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE recipient_status AS ENUM ('LOCKED', 'VERIFIED', 'CLAIMED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE voucher_status AS ENUM ('AVAILABLE', 'ISSUED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Tables
--
-- `vouchers` is created first, then `recipients` (which references it), then
-- the back-reference vouchers.issued_to -> recipients.id is added by ALTER.
-- Declaring both inline fails with "relation vouchers does not exist".
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  status      voucher_status NOT NULL DEFAULT 'AVAILABLE',
  issued_to   uuid,
  issued_at   timestamptz,
  expires_at  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  email        text NOT NULL,
  access_code  text NOT NULL UNIQUE,
  status       recipient_status NOT NULL DEFAULT 'LOCKED',
  assigned_to  text,
  verified_at  timestamptz,
  claimed_at   timestamptz,
  voucher_id   uuid REFERENCES vouchers(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE vouchers
    ADD CONSTRAINT fk_vouchers_issued_to
    FOREIGN KEY (issued_to) REFERENCES recipients(id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- FIX C5 (database side) — the adapter looks codes up with `.eq()` on an
-- uppercased string. A lowercase row would then be silently unreachable: the
-- recipient's emailed code would never work and nobody would know why. Refuse
-- the bad row at write time instead.
DO $$ BEGIN
  ALTER TABLE recipients
    ADD CONSTRAINT recipients_access_code_is_upper
    CHECK (access_code = upper(access_code));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- PENDING DECISION — form_responses shape.
--   Handoff §6:  discrete columns (full_name, email, phone, company)
--   BUILD SPEC:  payload jsonb
-- Built as jsonb, kept as jsonb here so nothing breaks while the decision is
-- open. Note the cost: every §15 funnel query has to reach into the JSON
-- (payload->>'email'), and nothing stops a malformed payload being stored.
-- Switching to discrete columns means altering this table AND the INSERT in
-- draw_voucher_atomic below.
CREATE TABLE IF NOT EXISTS form_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  payload       jsonb NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recipients_access_code   ON recipients (access_code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status          ON vouchers (status);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_to       ON vouchers (issued_to);
CREATE INDEX IF NOT EXISTS idx_form_responses_recipient ON form_responses (recipient_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security — deny anon and authenticated entirely.
--    All access is server-side via the service role key.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE recipients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

-- Force RLS so even a table owner connection is subject to it.
ALTER TABLE recipients     FORCE ROW LEVEL SECURITY;
ALTER TABLE vouchers       FORCE ROW LEVEL SECURITY;
ALTER TABLE form_responses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny public access to recipients" ON recipients;
CREATE POLICY "Deny public access to recipients"
  ON recipients FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny public access to vouchers" ON vouchers;
CREATE POLICY "Deny public access to vouchers"
  ON vouchers FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny public access to form_responses" ON form_responses;
CREATE POLICY "Deny public access to form_responses"
  ON form_responses FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Belt and braces: remove the table grants as well, so access does not rest on
-- the policies alone.
REVOKE ALL ON recipients, vouchers, form_responses FROM anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Atomic voucher draw
--
-- FIX C4 — the previous version of this function was SECURITY DEFINER with no
-- EXECUTE revoke. Postgres grants EXECUTE to PUBLIC by default, and a
-- SECURITY DEFINER function runs as its owner, bypassing RLS. Anyone holding
-- the publishable anon key could therefore call
--     supabase.rpc('draw_voucher_atomic', { ... })
-- straight from a browser and drain the entire voucher pool. The RLS policies
-- above did not stop it — the function ran as the owner, not as anon.
--
-- Two changes:
--   • SECURITY INVOKER — the function now runs as the CALLING role. Called by
--     service_role (which bypasses RLS) it works; called by anon it hits the
--     deny-all policies and sees nothing.
--   • EXECUTE revoked from PUBLIC/anon/authenticated, granted to service_role
--     only. See the grants immediately after the function body.
--
-- FIX C2 — the function issued a voucher to any recipient id it was handed,
-- including one still LOCKED, i.e. someone who never passed the gate. It now
-- refuses anything that is not VERIFIED (or already CLAIMED, for idempotency).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION draw_voucher_atomic(
  p_recipient_id uuid,
  p_form_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient recipients%ROWTYPE;
  v_voucher   vouchers%ROWTYPE;
  v_now       timestamptz := now();
BEGIN
  -- Lock the recipient row for the duration of the transaction.
  SELECT * INTO v_recipient
  FROM recipients
  WHERE id = p_recipient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECIPIENT_NOT_FOUND';
  END IF;

  -- Idempotency (spec §7): an already-CLAIMED recipient gets the voucher
  -- already linked to them, never a second draw. Checked before the VERIFIED
  -- gate below, since CLAIMED is past VERIFIED in the state machine.
  IF v_recipient.status = 'CLAIMED' THEN
    IF v_recipient.voucher_id IS NULL THEN
      RAISE EXCEPTION 'DATA_INTEGRITY_CLAIMED_WITHOUT_VOUCHER: recipient %', p_recipient_id;
    END IF;

    SELECT * INTO v_voucher FROM vouchers WHERE id = v_recipient.voucher_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA_INTEGRITY_CLAIMED_WITHOUT_VOUCHER: recipient %', p_recipient_id;
    END IF;

    RETURN jsonb_build_object(
      'voucher_code', v_voucher.code,
      'expires_at',   v_voucher.expires_at
    );
  END IF;

  -- FIX C2 — must have passed the gate.
  IF v_recipient.status <> 'VERIFIED' THEN
    RAISE EXCEPTION 'RECIPIENT_NOT_VERIFIED';
  END IF;

  -- Atomic draw. SKIP LOCKED means two concurrent claims take different rows
  -- instead of one waiting on the other, and never the same voucher code.
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE status = 'AVAILABLE'
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VOUCHER_POOL_EXHAUSTED';
  END IF;

  INSERT INTO form_responses (recipient_id, payload, submitted_at)
  VALUES (p_recipient_id, p_form_payload, v_now);

  UPDATE vouchers
     SET status    = 'ISSUED',
         issued_to = p_recipient_id,
         issued_at = v_now
   WHERE id = v_voucher.id;

  UPDATE recipients
     SET status     = 'CLAIMED',
         claimed_at = v_now,
         voucher_id = v_voucher.id
   WHERE id = p_recipient_id;

  RETURN jsonb_build_object(
    'voucher_code', v_voucher.code,
    'expires_at',   v_voucher.expires_at
  );
END;
$$;

-- FIX C4 — lock down who may call it. Without these two lines the function is
-- executable by every role in the project, including anon.
REVOKE ALL ON FUNCTION draw_voucher_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION draw_voucher_atomic(uuid, jsonb) TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Reporting view for the §15 funnel. Service role only.
--    Counts only — never the codes themselves, never the pool contents.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW campaign_funnel AS
SELECT
  count(*)                                        AS recipients_total,
  count(*) FILTER (WHERE status <> 'LOCKED')      AS verified,
  count(*) FILTER (WHERE status = 'CLAIMED')      AS claimed,
  count(*) FILTER (WHERE status = 'VERIFIED')     AS verified_not_claimed,
  (SELECT count(*) FROM vouchers WHERE status = 'AVAILABLE') AS vouchers_available
FROM recipients;

REVOKE ALL ON campaign_funnel FROM PUBLIC, anon, authenticated;
GRANT SELECT ON campaign_funnel TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Pre-flight check before the announcement email goes out.
--
--    Open items 4 and 5 block this. Run it after loading the real voucher
--    batch; it must return zero rows.
--
--    SELECT 'pool smaller than recipient list' AS problem
--      WHERE (SELECT count(*) FROM vouchers WHERE status = 'AVAILABLE')
--          < (SELECT count(*) FROM recipients WHERE status <> 'CLAIMED')
--    UNION ALL
--    SELECT 'voucher expiry is in the past'
--      WHERE EXISTS (SELECT 1 FROM vouchers WHERE expires_at <= current_date)
--    UNION ALL
--    SELECT 'placeholder codes still in the pool'
--      WHERE EXISTS (SELECT 1 FROM vouchers WHERE code ILIKE 'PLACEHOLDER%');
-- ───────────────────────────────────────────────────────────────────────────

# Tebus Baucar Anda — Campaign Voucher Redemption

Access-code gate → native form → single-use ZUS Coffee voucher.
Bahasa Malaysia, mobile first.

Built in two phases against one codebase. Phase 1 runs on seeded in-memory mock
data; Phase 2 swaps to Supabase. **The UI is identical in both.**

> Read `FIXES.md` before changing anything. It records an audit of this build
> against the handoff spec, including five security issues that were reproduced
> as working exploits, and lists the decisions still open.

---

## Run it

```bash
npm install
cp .env.example .env
```

Then set **`SESSION_SECRET`** in `.env`. The app will not start without it:

```bash
openssl rand -base64 48
```

```bash
npm run dev          # http://localhost:3000
```

Phase 1 needs no Supabase credentials. Leave both Supabase variables blank.
If a hosting panel insists on values, use placeholders — do not paste a real
service role key into a build environment.

Test codes print to the **server console** at boot in mock mode. They are
deliberately not in the browser bundle (spec §9).

---

## Architecture

```
src/                      React SPA — gate, form, success
server.ts                 Express: /api/verify, /api/claim, /api/session
lib/data/adapter.ts       ← the boundary. Nothing above it touches a database.
lib/data/mock.ts          Phase 1 in-memory store
lib/data/supabase.ts      Phase 2, service role, server-side only
lib/auth/session.ts       HMAC-signed httpOnly cookie, 2h
lib/security/rateLimit.ts IP resolution + verify throttling
lib/validation/           Zod schema and field normalisation
supabase/migrations/      Schema, RLS, atomic draw RPC
```

Route handlers import `dataAdapter` and nothing below it. No component imports
a database client. No component holds a code list.

### Invariants — do not let a patch break these

- Nothing above `lib/data/adapter.ts` touches Supabase directly.
- The UI does not change between phases.
- `VERIFIED` stays re-enterable. Only `CLAIMED` rejects.
- The draw stays in Postgres, `FOR UPDATE SKIP LOCKED`, never in application code.
- `/api/claim` is idempotent — already claimed returns the linked voucher.
- The service role key is server-only. Never `NEXT_PUBLIC_`.
- The voucher code never appears in a verify response.
- Pool-exhausted gets its own screen, not a generic error.

---

## Switching to Supabase

**1. Run the migration** — Supabase SQL Editor or CLI:

```
supabase/migrations/20260101000000_campaign_vouchers.sql
```

Creates the three tables, enables and forces RLS denying `anon` and
`authenticated`, creates `draw_voucher_atomic` with `EXECUTE` granted to
`service_role` only, and adds a `campaign_funnel` reporting view.

**2. Load the pool and the recipient list.** Access codes must be uppercase —
a `CHECK` constraint enforces it, because a lowercase row would be permanently
unreachable through the gate.

```sql
INSERT INTO vouchers (code, expires_at) VALUES
  ('REAL-CODE-1', '2026-12-31'),
  ('REAL-CODE-2', '2026-12-31');

INSERT INTO recipients (full_name, email, access_code, status) VALUES
  ('Ahmad Farhan', 'farhan@example.com.my', 'K7M4QX', 'LOCKED');
```

Codes should be alphanumeric excluding `I`, `O`, `0`, `1` — they get retyped
from an email on a phone (§9).

**3. Set the environment:**

```env
DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…          # server-only
SESSION_SECRET=…                      # required
TRUSTED_CLIENT_IP_HEADER=…            # match your platform — see .env.example
CAMPAIGN_END_ISO=2026-12-31T23:59:59+08:00
```

**4. Before handing links to marketing**, confirm:

```sql
-- must fail when run as anon
select draw_voucher_atomic('00000000-0000-0000-0000-000000000000'::uuid, '{}'::jsonb);

-- must return zero rows
SELECT 'pool smaller than recipient list' AS problem
  WHERE (SELECT count(*) FROM vouchers WHERE status = 'AVAILABLE')
      < (SELECT count(*) FROM recipients WHERE status <> 'CLAIMED')
UNION ALL
SELECT 'voucher expiry in the past'
  WHERE EXISTS (SELECT 1 FROM vouchers WHERE expires_at <= current_date)
UNION ALL
SELECT 'placeholder codes still in the pool'
  WHERE EXISTS (SELECT 1 FROM vouchers WHERE code ILIKE 'PLACEHOLDER%');
```

---

## Reporting

```sql
SELECT * FROM campaign_funnel;
```

`Sent → Verified → Submitted → Claimed`. The **Verified-to-Submitted gap** is
the leak worth watching — it tells you whether the form is too long, which is
the one thing still fixable mid-campaign. `verified_not_claimed` is also the
correct target list for a reminder send.

---

## Deployment

This is a Vite SPA served by a long-running Express process — **not** a Next.js
app, despite what the handoff specifies. It runs on any Node host (Cloud Run,
Render, Fly, a container). It does **not** deploy to Vercel as-is. See
`PLATFORM_NOTES.md`.

```bash
npm run build && npm start
```

Rate limit state is in-process. On more than one instance the effective limit
multiplies by the instance count — see the note at the bottom of
`lib/security/rateLimit.ts` before scaling out.

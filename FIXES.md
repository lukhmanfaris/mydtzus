> **Superseded (1 Oct 2026).** This describes the previous access-code / instant-voucher
> build, which has been replaced by the Intro → Form → Thank-you flow on Cloudflare
> Workers. Kept for history. See `README.md` for the current app.

# Audit and fixes — Tebus Baucar Anda

Audit of the Google AI Studio build against `ZUS_Voucher_Campaign_Handoff.md`.
Date: 19 September 2026.

Every issue marked **exploited** was reproduced against the running app before
the fix and re-tested after it. Nothing here is a static guess.

---

## What was already correct

Worth stating, because most of the architecture survived the audit intact:

- The `LOCKED → VERIFIED → CLAIMED` state machine behaves per §5.
  `VERIFIED` is re-enterable; only `CLAIMED` rejects.
- `/api/claim` is idempotent — an already-claimed recipient gets back the same
  voucher, never a second draw.
- Pool exhaustion has its own screen, not a generic error (§12).
- The verify response never contains a voucher code (§7).
- The SQL migration creates `vouchers` before `recipients` and adds the back
  reference by `ALTER`, which is correct — the ordering in the BUILD SPEC would
  have failed with `relation "vouchers" does not exist`.
- The atomic draw is a Postgres RPC using `FOR UPDATE SKIP LOCKED`, never
  application-side.
- The Supabase client is constructed lazily, so **Phase 1 boots with no
  Supabase credentials present**, as §14 requires. Confirmed by running the app
  with both variables unset. The AI Studio environment-variable panel is its own
  secrets gate, not a defect in this code.

---

## Critical — exploited before the fix

### C1 · Forgeable session, complete gate bypass
`lib/auth/session.ts`

`getSecret()` fell back to a hardcoded literal when `SESSION_SECRET` was unset.
Anyone with the source could mint a valid cookie for any recipient id.

> **Exploit:** forged a cookie for `rec-test-aa` and called `/api/claim` with no
> access code ever entered. Response: `{"voucherCode":"ZUS-MIA82-K9Q"}`.

**Fix:** no fallback. A missing or under-32-character secret is fatal, and
`assertSessionSecretConfigured()` runs at boot so a bad deployment fails
immediately rather than at the first user's verify attempt.

**After:** forged cookie → `401`. Server refuses to start without the variable.

> **Action required:** `SESSION_SECRET` must now be set in every environment,
> including Phase 1. Generate with `openssl rand -base64 48`.

### C2 · Claim step never checked the recipient had passed the gate
`lib/data/mock.ts`, `supabase/migrations/…sql`, `server.ts`

`claimVoucher` issued a voucher to any recipient id handed to it, including one
still `LOCKED`. C1 was the way in; this was why the door opened.

**Fix:** both adapters and the Postgres RPC now reject anything that is not
`VERIFIED`, with `CLAIMED` short-circuiting first for idempotency. The route
maps it to `403`, clears the cookie and sends the user back to the gate.

**After:** cookie signed with the *correct* secret naming a `LOCKED` recipient →
`403 NOT_VERIFIED`. The gate is enforced even if the signing key leaks.

Also fixed here: a `CLAIMED` recipient whose `voucher_id` could not be resolved
used to fall through and draw a **second** voucher. That now raises a data
integrity error instead of silently issuing twice.

### C3 · Rate limit bypassed by header spoofing
`server.ts` → new `lib/security/rateLimit.ts`

The limiter read `x-forwarded-for` straight off the request, and `trust proxy`
was set to `true`, so Express believed anything a client sent.

> **Exploit:** 12 attempts from one spoofed IP → blocked at 10. 12 attempts
> rotating the header → **all 12 passed**. Unlimited guesses against a small
> code space.

**Fix:** forwarded headers are trusted only when `TRUSTED_CLIENT_IP_HEADER`
explicitly names one; otherwise the socket address is used. Added a global
failure ceiling as a backstop against rotating real source IPs.

**After:** rotating `x-forwarded-for`, `cf-connecting-ip` and `x-real-ip` all hit
`429` at the limit.

> **Action required:** set `TRUSTED_CLIENT_IP_HEADER` to match the platform —
> `cf-connecting-ip` on Cloudflare, `x-vercel-forwarded-for` on Vercel. Leave it
> blank for direct-to-Node. Setting it wrong is worse than leaving it unset.

### C4 · `draw_voucher_atomic` was callable by `anon`
`supabase/migrations/…sql`

The function was `SECURITY DEFINER` — it runs as its owner and bypasses RLS —
and Postgres grants `EXECUTE` to `PUBLIC` by default. Nothing revoked it.
Anyone holding the publishable anon key could call the RPC straight from a
browser and drain the pool. The RLS policies did not apply, because the function
ran as the owner rather than as `anon`.

**Fix:** switched to `SECURITY INVOKER` so it runs as the calling role, then
`REVOKE ALL … FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE … TO
service_role`. Two independent barriers.

Not runtime-tested here — no Supabase project was available. Verify after
running the migration:

```sql
-- as anon, must fail
select draw_voucher_atomic('00000000-0000-0000-0000-000000000000'::uuid, '{}'::jsonb);
```

### C5 · `ilike()` wildcard on the access code
`lib/data/supabase.ts`

`getRecipientByCode` used `.ilike(access_code, input)`. `ilike` is a pattern
operator — an access code of `%` matches the first recipient row, opening the
gate for someone with no code at all.

**Fix:** `.eq()`. The input is already uppercased, so codes must be stored
uppercase; a `CHECK (access_code = upper(access_code))` constraint in the
migration now enforces that at write time, because a lowercase row would
otherwise be silently unreachable forever.

---

## High — spec violations with user impact

### H1 · Fabricated voucher code shown to users
`src/App.tsx`

```tsx
voucherCode={claimedVoucher?.voucherCode || 'ZUS-PROMO-COFFEE'}
expiresAt={claimedVoucher?.expiresAt || '2026-12-31'}
```

Anyone reaching `/success` without a claim in memory — a reload, a bookmark, a
shared link — was shown an invented code styled exactly like a real one, which
ZUS would reject at the counter.

**Fix:** no fallback. No claim, no screen.

> This makes the underlying gap visible rather than papering over it: a user who
> reloads `/success` has lost their voucher, because their code is now `CLAIMED`
> and re-entering it returns `409`. **The post-claim email is what closes this**
> (§2, open item 6).

### H2 · Wrong form field set — *not fixed, decision pending*
Spec §8 requires **Full name · Email · Phone · Company (Syarikat)**.
The build has **Full name · Phone · Email · State/Outlet · T&C checkbox**.
`Syarikat` is absent; the other two are in neither spec.

Left as built so nothing breaks. `lib/validation/form.ts` carries the exact
change list at the top of the file.

### H3 · Phone not normalised → **fixed**
`lib/validation/normalise.ts` (new)

The same person typing `012-345 6789`, `+60123456789` or `0123456789` produced
three different database rows. Now normalised to `60XXXXXXXXX` per §8, silently,
rejecting only when the result isn't 10–12 digits.

### H4 · Email not lowercased → **fixed**
`NURUL@Example.COM.MY` was stored as typed. Now lowercased on store.

### H5 · Access code list compiled into the client bundle
`src/components/GateScreen.tsx`

Five codes were hardcoded as clickable buttons, shown when `DATA_SOURCE=mock`.
Gating only hid them — they shipped inside the JavaScript bundle in **both**
phases and were readable in devtools. Breaks §4 ("no component holds a code
list") and §9 ("never render the access code list under any condition"). It also
meant the UI differed between phases, which §4 forbids.

**Fix:** panel removed. Codes print to the server console at boot in mock mode.

**After:** `grep -r "TESTAA" dist/assets/` → no match. The gate screen is now
byte-identical under both `DATA_SOURCE` values.

### H6 · Adapter boundary leak
`server.ts`

`/api/session` imported `mockStore` directly. Under `DATA_SOURCE=supabase` it
returned a **fabricated** `{fullName:'', email:'', status:'VERIFIED'}`.

**Fix:** `getRecipientById` added to the `DataAdapter` interface and implemented
in both adapters. The route goes through the boundary like everything else, and
now also clears a cookie pointing at a recipient who no longer exists.

### H7 · Dev endpoints reachable in production
`/api/mock/reset` was gated on `DATA_SOURCE` alone, so a stray value would have
exposed it. Now requires mock mode **and** a non-production build.
`/api/config` no longer returns `dataSource` — the browser has no business
knowing which backend is live.

---

## Medium

| ID | Issue | Status |
|---|---|---|
| M1 | Built as Vite + React SPA with an Express server, not Next.js. Will not deploy to Vercel as-is | **Open — platform decision** |
| M2 | `app/api/verify/route.ts` and `app/api/claim/route.ts` were Next.js handlers excluded in `tsconfig.json` and never executed — two implementations of each endpoint, one of them fiction | Deleted |
| M3 | `npm install` failed on an `esbuild` / `vite@8` peer conflict; only worked under Bun or `--legacy-peer-deps` | Fixed — `esbuild@^0.28.0`; clean install verified |
| M4 | No post-claim voucher email. Close the tab, lose the voucher | **Open — see delivery notes** |
| M5 | `form_responses.payload jsonb` instead of discrete columns; every §15 funnel query must reach into the JSON | **Open — decision pending** |
| M6 | Reloading `/success` loses the voucher | Root cause exposed (H1); real fix is M4 |
| M7 | Rate limit state is in-process; multiplies by instance count | Documented in `rateLimit.ts` with the migration path |
| M8 | `CLAIMED` with unresolvable voucher drew a second voucher | Fixed with C2 |
| M9 | Voucher codes and the `2026-12-31` expiry were invented — open items 4 and 5 silently filled with fiction | Renamed to `PLACEHOLDER-*`; pre-flight SQL check added to the migration |
| M10 | Unused `@google/genai` dependency and Gemini capability from the AI Studio scaffold | Removed |
| M11 | Success screen presented four **invented** ZUS app redemption steps as fact | Removed, with a note to restore once ZUS confirms the real process |

A `campaign_funnel` view was added to the migration for the §15 reporting —
counts only, service role only, never the codes or the pool contents.

---

## Verification

```
npm install          clean, no --legacy-peer-deps
npx tsc --noEmit     clean
npm run build        client + server bundle OK
```

Behaviour, re-tested after the fixes:

| Check | Result |
|---|---|
| Boot with no `SESSION_SECRET` | refuses to start |
| Boot with a short `SESSION_SECRET` | refuses to start |
| Forged cookie, old hardcoded secret | `401` |
| Valid signature, `LOCKED` recipient | `403 NOT_VERIFIED` |
| 12 verifies rotating `x-forwarded-for` | `429` at the limit |
| `VERIFIED` re-entry (`TESTBB`) | `200` |
| `CLAIMED` rejection (`TESTCC`) | `409` |
| Claim idempotency | same voucher twice |
| Pool exhaustion after 3 draws | `503 POOL_EXHAUSTED` |
| `012-345 6789` | stored `60123456789` |
| `AHMAD@Example.COM.MY` | stored `ahmad@example.com.my` |
| Access codes in client bundle | none |
| Supabase client in client bundle | none |
| Phase 1 with no Supabase credentials | boots, full flow works |

Not covered: anything requiring a live Supabase project — C4's revoke, C5's
`.eq()` behaviour against real rows, and the RPC's `VERIFIED` enforcement. Run
the migration and re-test those before flipping `DATA_SOURCE=supabase`.

---

## Still blocking the announcement email

Unchanged from handoff §16, and none of it is fixable in code:

1. **Open item 4** — the real ZUS voucher batch. The pool is `PLACEHOLDER-*`.
2. **Open item 5** — the real expiry date. `2026-12-31` is invented.
3. **Open item 6** — the transactional email provider. Until this exists, a user
   who closes the success tab has permanently lost their voucher.

A valid access code redeeming into a placeholder voucher is the worst failure
mode this campaign has.

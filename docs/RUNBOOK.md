# ZUS Coffee Voucher Campaign

Campaign image → Terms & Conditions → form → thank-you. English, mobile first.
Vouchers are **not** issued by the app: the team emails them (via Zoho) within
48 hours, using the submissions exported from Supabase.

```
Zoho email blast (manual) ──CTA──▶  1. Campaign image → "Participate"
                                     2. T&C: 3 documents in tabs, each as slides; one "I Agree"
                                        (unlocks once every document is read to the end)
                                     3. Form: Referral Code · Full Name · Phone · Email · Company
                                        → Submit (no tick boxes)
                                     4. Thank you — "voucher within 48 hours"
                                     (Closed screen once CAMPAIGN_END_ISO passes)
```

---

## Stack

| Part | What |
|---|---|
| `src/` | React 19 + Tailwind 4 SPA, built by Vite |
| `worker/index.ts` | Cloudflare Worker (Hono): `GET /api/config`, `POST /api/submit` |
| `lib/validation/` | Zod schema + phone/email normalisation, shared by browser and Worker |
| `lib/data/` | Adapter boundary — `mock` (local) or `supabase` (production) |
| `lib/security/turnstile.ts` | Cloudflare Turnstile server-side check |
| `supabase/migrations/` | `submissions` table + `submissions_export` view |
| `supabase/optional/` | Voucher auto-assign script — only if you choose that option |

The React app is served by Workers Assets; only `/api/*` runs the Worker.

### What `POST /api/submit` does, in order

1. **Closing date** — after `CAMPAIGN_END_ISO` → `410`, UI shows "campaign has ended".
2. **Rate limit** — 10 requests per minute per IP (`CF-Connecting-IP`, set by Cloudflare's edge and not spoofable) → `429`.
3. **Validation** — Zod, with phone normalised to `60XXXXXXXXX`, email lowercased, referral code uppercased → `400` with per-field messages.
4. **Bot check** — Turnstile token verified with Cloudflare → `403`. Fails closed if Cloudflare is unreachable or the secret is missing.
5. **Repeat guard** — the same email **and** phone within 10 minutes (double tap,
   back-and-resubmit) gets `201` but is not stored again.
6. **Insert** into `submissions` with a server-stamped `terms_accepted_at` → `201`.

Repeats outside the 10-minute window are allowed in by design; the export view
flags them.

### Daily keep-alive

Supabase pauses free projects after a stretch with no activity, which would make
every submission fail. A Cloudflare cron (`triggers.crons` in `wrangler.jsonc`,
09:00 MYT daily) runs one tiny read against `submissions`. Check it in the
Cloudflare dashboard → Workers → `mydtzus` → Logs (look for `Keep-alive ping OK`).

---

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars     # mock data + Turnstile test keys
npm run dev                        # http://localhost:5173
```

`npm run dev` runs the Worker in the real Workers runtime (via `@cloudflare/vite-plugin`).
With `DATA_SOURCE=mock`, each submission is printed to the terminal and kept in
memory until restart. Set `CAMPAIGN_END_ISO` to a past date to preview the
closed screen.

```bash
npm run lint      # type-check browser + Worker
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

---

## Go live

**1. Supabase** — create a project, then run every file in
`supabase/migrations/` in the SQL Editor, oldest first.

On the existing live project, `20261002000000_remove_consent_at.sql` is run in
two steps around the deploy so submissions never fail: **STEP 1** before merging
the change that stops sending `consent_at`, **STEP 2** once that deploy is live.

**2. Turnstile** — Cloudflare dashboard → Turnstile → add a widget for your
domain (mode: *Managed*). Note the site key and secret key.

**3. Configure the Worker.** Non-secret values go in `wrangler.jsonc` → `vars`:

```jsonc
"DATA_SOURCE": "supabase",
"SUPABASE_URL": "https://<project>.supabase.co",
"TURNSTILE_SITE_KEY": "<site key>",
"CAMPAIGN_END_ISO": "2026-12-31T23:59:59+08:00"
```

Secrets go in with Wrangler — never in a file:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

**4. Deploy** — merge to `main` and GitHub Actions deploys it (see
[Auto-deploy](#auto-deploy)). `npm run deploy` from your machine still works.
A custom domain can be attached in the Cloudflare dashboard (Workers → the
worker → Settings → Domains & Routes).

**5. Before the Zoho blast**, check on the live URL:
- the form submits and a row appears in `submissions`;
- `src/content/campaign.ts` has the real image and `HERO_IMAGE.placeholder = false`
  (otherwise a yellow "Draft" banner shows on the campaign page);
- the closing date is right.

---

## Content

All copy that marketing will want to change lives in **`src/content/campaign.ts`**:
the campaign image and the T&C documents (`TERMS_DOCUMENTS`: one tab per
document, one slide per section — add or remove freely). Documents marked
`placeholder: true` show a draft banner on the T&C page. Put the real
campaign image in `public/`, point `HERO_IMAGE.src` at it and set
`placeholder: false`.

Document 1 is published verbatim from `Terms_and_Conditions_for_Zus_Redemption_LEGAL280926.docx`
(tracked changes accepted). Documents 2 and 3 are placeholders. All three are
pending legal approval; replace the text there when legal issues the final versions.

---

## Sending vouchers

Supabase dashboard → SQL Editor → run the query below → download the results
as CSV:

```sql
-- One row per person: the earliest entry for each email and each phone.
select submitted_at, full_name, email, phone, company_name, referral_code, voucher_code
from submissions_export
where status = 'PENDING' and first_by_email and first_by_phone
order by submitted_at;
```

`email_count` / `phone_count` show how many entries share a value, for anything
you want to review by hand.

After sending from Zoho, record it:

```sql
update submissions set status = 'SENT', voucher_sent_at = now()
where id in (...);            -- or by email list
-- Exclude an entry: set status = 'REJECTED'
```

### Matching vouchers to people — still to decide

- **Manual:** paste codes into the `voucher_code` column (or keep them in your
  own spreadsheet). Nothing else needed.
- **Automatic:** run `supabase/optional/voucher_auto_assign.sql` once, load ZUS's
  codes into `vouchers`, then `select assign_pending_vouchers();` before each
  export. It gives one code per person (earliest entry per email and phone),
  skips `REJECTED`, and is safe to re-run. Instructions are at the top of the file.

Either way, no change to the app or its screens.

---

## Auto-deploy

`.github/workflows/deploy.yml` runs on every push to `main` (and on demand from
the Actions tab): `npm ci` → type-check → build → `wrangler deploy`. A failed
type-check or build stops the deploy, so the live site keeps the last good version.

One-time setup:
1. Cloudflare dashboard → **My Profile → API Tokens → Create Token** → template
   **Edit Cloudflare Workers** → account: *Mydatamarcomm@gmail.com's Account*,
   zone: *All zones* → Create, copy the token.
2. GitHub → repo **Settings → Secrets and variables → Actions → New repository
   secret** → name `CLOUDFLARE_API_TOKEN`, value: the token.

The account is set by `account_id` in `wrangler.jsonc`. Worker secrets (Supabase,
Turnstile) live in Cloudflare and are untouched by deploys.

---

## Limits worth knowing

- The rate limit is counted per Cloudflare location, not globally — it dampens
  abuse, it is not exact accounting. Turnstile is the main bot defence.
- Turnstile does not stop real people who were forwarded the link. The referral
  code is free text, so the export review is the safeguard there.

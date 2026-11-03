# ZUS Coffee Voucher Campaign

Campaign image → Terms & Conditions → form → thank-you. English, mobile first.
Vouchers are **not** emailed by the app: Supabase assigns codes first come,
first served, and the team emails them (via Zoho mail merge) within 48 hours.

```
Zoho email blast (manual) ──CTA──▶  1. Campaign image → "Participate"
                                     2. T&C: one document as slides (one per section); "I Agree"
                                        unlocks once the last section is reached
                                     3. Form: Referral Code · Full Name · Phone · Email · Company
                                        → Submit (no tick boxes)
                                     4. Thank you — "voucher within 48 hours"
                                     (Closed screen once CAMPAIGN_END_ISO passes, or
                                      "All vouchers have been claimed" once codes run out)
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
| `supabase/migrations/` | `submissions` table, `submissions_export` view, `vouchers` + first-come-first-served assignment |

The React app is served by Workers Assets; only `/api/*` runs the Worker.

### What `POST /api/submit` does, in order

1. **Closing date** — after `CAMPAIGN_END_ISO` → `410`, UI shows "campaign has ended".
2. **Rate limit** — 10 requests per minute per IP (`CF-Connecting-IP`, set by Cloudflare's edge and not spoofable) → `429`.
3. **Validation** — Zod, with phone normalised to `60XXXXXXXXX`, email lowercased, referral code uppercased → `400` with per-field messages.
4. **Bot check** — Turnstile token verified with Cloudflare → `403`. Fails closed if Cloudflare is unreachable or the secret is missing.
5. **Repeat guard** — the same email **and** phone within 10 minutes (double tap,
   back-and-resubmit) gets `201` but is not stored again.
6. **Vouchers left** — once every code has a person (see
   [When the codes run out](#when-the-codes-run-out)) → `410 FULLY_CLAIMED`, UI
   shows "All vouchers have been claimed". Someone who already entered gets `201`.
7. **Insert** into `submissions` with a server-stamped `terms_accepted_at` → `201`.

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
the campaign image and the T&C (`TERMS_SECTIONS`: one slide per section — add
or remove freely; clause numbers follow the order; web addresses in the text
become tappable links). Put the real campaign image in `public/`, point
`HERO_IMAGE.src` at it and set `placeholder: false`.

The banner at the top of the T&C, form, thank-you and closed pages is
`PAGE_BANNER`: one image for all of them, supplied at **2000 × 516 px**.
Drop it into `public/` and point `PAGE_BANNER.src` at it.

The T&C is published verbatim from
`CLEAN_Draft_Terms_and_Conditions_for_Zus_Redemption_LEGAL071026.docx`
(6 sections, 25 clauses, including the Personal Data Protection section),
including the typos in legal's text. Replace the clause text in
`TERMS_SECTIONS` when legal issues a new version. This version replaced the
earlier 5-section text (`…LEGAL280926`) and the two placeholder documents.
The database stores only `terms_accepted_at`, not which version was accepted.

---

## Sending vouchers

First come, first served: the earliest entry gets row 1 of ZUS's code list,
the next gets row 2, and so on. Rows are used strictly in order and never
skipped. One code per person: a repeat entry with the same email **or** the
same phone is not a new person. Entries marked `REJECTED` never get a code.

### One-time setup

1. Supabase → SQL Editor → run `supabase/migrations/20261103000000_vouchers.sql`.
2. Prepare ZUS's codes as a CSV with a header row:

   ```
   seq,code,expires_at
   1,ZUSABC123,2026-12-31
   2,ZUSDEF456,2026-12-31
   ```

   `seq` is the row number in ZUS's list (in Excel: type 1 and 2, then drag
   the fill handle down). `expires_at` is optional; drop the column if ZUS
   gave no expiry date.
3. Supabase → Table Editor → `vouchers` → Insert → **Import data from CSV**.
   **Never commit the codes to GitHub**: the repository is public.
4. Check the import: `select count(*), min(seq), max(seq) from vouchers;`
   The count must equal `max`, with `min` = 1. A gap means a row was lost.
5. Zoho Marketing Automation (menu names may differ slightly):
   - **Settings → Fields** (contact fields): add `Voucher Code` (text) and
     `Voucher Expiry` (text or date).
   - Build the voucher email template. Insert the name, code and expiry from
     the **merge tag / personalization menu**. Do not type the tags by hand,
     or they arrive as raw text.

### Each batch (before each Zoho send)

```sql
-- 1. Exclude anything that should not get a code (spam, test entries):
update submissions set status = 'REJECTED' where email in ('...');

-- 2. Hand out the next codes, in list order. Returns how many were assigned.
select assign_pending_vouchers();

-- 3. The send list:
select * from voucher_send_list;
```

Run one batch a day: that keeps the "voucher within 48 hours" promise. Then
send it through Zoho Marketing Automation:

1. Download the step 3 result as CSV.
2. Zoho → **Contacts → Import** → upload the CSV and map the columns:

   | CSV column        | Zoho field     |
   |-------------------|----------------|
   | `email`           | Email          |
   | `full_name`       | Name           |
   | `voucher_code`    | Voucher Code   |
   | `voucher_expires` | Voucher Expiry |

   Add the contacts to a **new list for each batch**, e.g.
   `ZUS Voucher – Batch 1 (11 Nov)`, so nobody gets the email twice. If Zoho
   asks about consent / opt-in type, choose MYDATA's usual option (they agreed
   to the T&C on the form).
3. Create an email campaign from the voucher template. Recipients: **that
   batch list only**. Send.
4. Open the campaign's send report and check for skipped or bounced contacts
   (see below).
5. Mark the batch as sent in Supabase:

```sql
update submissions set status = 'SENT', voucher_sent_at = now()
where status = 'PENDING' and voucher_code is not null;
```

Do **not** run `assign_pending_vouchers()` between exporting the list and
marking it sent. Otherwise people assigned in between are marked SENT without
having been emailed.

`assign_pending_vouchers()` is safe to re-run: it only touches people without
a code, and stops quietly when the codes run out. `submissions_export` still
shows every entry with `email_count` / `phone_count` for review by hand.

### Skipped or bounced emails

- **Unsubscribed contacts are skipped.** Anyone who unsubscribed from an
  earlier MYDATA email does not get the Zoho campaign, but still holds a code.
  Send those codes by hand from Zoho Mail or Outlook.
- **Bounced emails** (typo in the address): the code is assigned but not
  delivered. Follow up by phone; the number is in `submissions`.

### When the codes run out

The form closes by itself: once the number of people (counted as above) reaches
the number of codes in `vouchers`, new visitors see **"All vouchers have been
claimed"**. Someone who already entered and submits again still sees the
thank-you page. With no codes loaded, the form stays open.

```sql
select * from voucher_capacity;   -- total_codes, claimed
```

- **Spam counts until it is marked `REJECTED`.** Rejecting entries frees their
  places and reopens the form.
- **Loading more codes** reopens the form too. Continue `seq` from the last row.
- A few people may get in at the exact moment the last place goes (two
  submissions in the same instant). They wait with no code; `assign_pending_vouchers()`
  gives them one only if more codes are loaded.
- If the capacity check itself fails (database glitch), the form stays open
  rather than closing by mistake.

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

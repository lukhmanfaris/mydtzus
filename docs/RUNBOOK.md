# ZUS Coffee Voucher Campaign

Campaign image → Terms & Conditions → form → thank-you. English, mobile first.
Vouchers are **not** emailed by the app: Supabase assigns codes first come,
first served within each group, and the team emails them (via Zoho mail merge)
within 48 hours. Each group has its own referral code and its own voucher limit.

```
Zoho email blast (manual) ──CTA──▶  1. Campaign image → "Participate"
                                     2. T&C: one document as slides (one per section); "I Agree"
                                        unlocks once the last section is reached
                                     3. Form: Referral Code · Full Name · Phone · Email · Company
                                        → Submit (no tick boxes)
                                     4. Thank you — "voucher within 48 hours"
                                     (Closed screen once CAMPAIGN_END_ISO passes, or
                                      "All vouchers have been claimed" once the group is full)
```

`/terms` shows the same T&C on one page for the emails to link to. It makes no
API call, so it stays up after the form closes or the vouchers run out.

---

## Stack

| Part | What |
|---|---|
| `src/` | React 19 + Tailwind 4 SPA, built by Vite |
| `worker/index.ts` | Cloudflare Worker (Hono): `GET /api/config`, `POST /api/submit` |
| `lib/validation/` | Zod schema + phone/email normalisation, shared by browser and Worker |
| `lib/data/` | Adapter boundary — `mock` (local) or `supabase` (production) |
| `lib/security/turnstile.ts` | Cloudflare Turnstile server-side check |
| `supabase/migrations/` | `submissions` table, `submissions_export` view, `vouchers` + first-come-first-served assignment, `referral_groups` + `enter_campaign` |

The React app is served by Workers Assets; only `/api/*` runs the Worker.

### What `POST /api/submit` does, in order

1. **Closing date** — after `CAMPAIGN_END_ISO` → `410`, UI shows "campaign has ended".
2. **Rate limit** — 10 requests per minute per IP (`CF-Connecting-IP`, set by Cloudflare's edge and not spoofable) → `429`.
3. **Validation** — Zod, with phone normalised to `60XXXXXXXXX`, email lowercased, referral code uppercased → `400` with per-field messages.
4. **Bot check** — Turnstile token verified with Cloudflare → `403`. Fails closed if Cloudflare is unreachable or the secret is missing.
5. **Repeat guard** — the same email **and** phone within 10 minutes (double tap,
   back-and-resubmit) gets `201` but is not stored again.
6. **Entry** — one database step, `enter_campaign` (see
   [Referral groups](#referral-groups)):
   - a code that isn't valid → `400` with an error on the Referral Code field;
   - the group is full → `410 FULLY_CLAIMED`, UI shows "All vouchers have been
     claimed". Someone who already entered gets `201`;
   - otherwise stored in `submissions` with a server-stamped `terms_accepted_at`
     → `201`.

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
memory until restart. The mock accepts one referral code, `LOCALTEST`. Set
`CAMPAIGN_END_ISO` to a past date to preview the closed screen.

**Keep `DATA_SOURCE=mock` in `.dev.vars`.** With `supabase` there, a local submit
writes a real row and can take a real group's place.

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

`20261105000000_referral_groups.sql` goes **before** merging the app change that
uses it, and at least one group must be loaded before that merge too:

1. Run the file in the SQL Editor. It only adds things, so the live form keeps
   working.
2. Add the group's row (see [Referral groups](#referral-groups)) and tag the codes
   already loaded:

   ```sql
   update vouchers set group_name = '<group name>' where group_name is null;
   ```

3. Check, one at a time. The first shows the group's limit and codes, and the
   second must show 0:

   ```sql
   select * from group_capacity;
   select count(*) from vouchers where group_name is null;
   ```

4. Merge, and wait for Deploy to go green.
5. On the live form, try a **wrong** code only. It should show the error, and
   `select count(*) from submissions;` should not change. A real code would take
   a real place.

If the merge lands first, Submit shows "Something went wrong" and nothing is
stored. Run steps 1 to 3 and it fixes itself, with no redeploy. If the new version
misbehaves, use the Revert button on the PR in GitHub: the old form still works,
because `voucher_capacity` and every existing column were left alone.

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
worker → Settings → Domains & Routes). Add the new hostname to the Turnstile
widget first, or the form will fail. Don't add `routes` to `wrangler.jsonc`: that
switches off the workers.dev address by default.

**5. Before the Zoho blast**, check on the live URL:
- a wrong referral code shows the error and stores nothing;
- `/terms` shows the terms;
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

## Referral groups

Each group has its own referral code, printed in that group's email 02, and its
own voucher limit. Groups live in Supabase only, in `referral_groups`. **Never
put a real code or limit in this repository: it is public.**

- **Wrong code:** an error shows under the Referral Code box, and nothing is
  stored. Capitals and spaces don't matter when people type it.
- **Group full:** a group's *places* are the lower of its limit and the codes
  loaded for it, so the form never promises a voucher that isn't there. A group
  with no codes loaded counts as full. Once it is full, the next person from
  that group sees **"All vouchers have been claimed"** after pressing Submit,
  and the other groups carry on.
- **Every active group full:** the opening page shows "All vouchers have been
  claimed" to everyone. It reopens when a group gets more places.
- **Already in:** someone with the same email and phone who submits again still
  sees the thank-you page, and no second row is stored.
- **Hard stop:** the code check, the limit check and the save are one step in
  the database (`enter_campaign`), so two people can't both take the last place.
- **One voucher per person across all groups.** A repeat entry with the same
  email **or** the same phone is not a new person, and their earliest entry
  decides their group.

### Add a group, or more codes for a group

Groups can be loaded at any time, one by one.

1. Supabase → Table Editor → `referral_groups` → Insert row:

   | Column          | Value                                                                  |
   |-----------------|------------------------------------------------------------------------|
   | `group_name`    | The group, e.g. `Sales`                                                |
   | `referral_code` | The one short group code in its email 02. **Not the voucher codes.**   |
   | `voucher_limit` | The group's number                                                     |
   | `active`        | true                                                                   |

   Type `referral_code` exactly as in the email, in capitals with no spaces. Then
   check it matches:

   ```sql
   select referral_code = '<code from email 02>' as matches_email from referral_groups
   where group_name = 'Sales';
   ```

   Skip this step when adding more codes to a group that already exists.
2. Find the next free row number:

   ```sql
   select coalesce(max(seq), 0) + 1 from vouchers;
   ```

3. Prepare the codes as a CSV with a header row. **Start `seq` at the number from
   step 2, never at 1.** Put the group's exact name on every row:

   ```
   seq,code,expires_at,group_name
   501,ZUSABC123,2026-12-25,Sales
   502,ZUSDEF456,2026-12-25,Sales
   ```

   `expires_at` is `2026-12-25` on every row, even if ZUS's list says 31 Dec.
4. Supabase → Table Editor → `vouchers` → Insert → **Import data from CSV**.
   **Never commit the codes to GitHub.**
5. Check it. `codes_loaded` must have gone up by the number of rows in the file:

   ```sql
   select * from group_capacity;
   ```

6. To use more codes than the old limit, raise it:

   ```sql
   update referral_groups set voucher_limit = <new number> where group_name = 'Sales';
   ```

7. Only then send that group's email 02.

**Why nothing clashes:** Supabase refuses a repeated row number, a repeated code
and a misspelt group name. If an import fails, run the step 5 check before trying
again, because rows that did go in would now clash. Codes used for the MarComm
test stay out of every other file.

**Never change a `referral_code` after its email 02 has gone out.** Entries are
matched to their group by that code.

To stop a code working, for example if it leaks:

```sql
update referral_groups set active = false where group_name = 'Sales';
```

The form then treats it as a wrong code. People already in keep their place and
still get their vouchers.

---

## Sending vouchers

First come, first served within each group: the group's earliest entry gets the
group's first free row, the next gets the next row, and so on. Rows are used
strictly in order and never skipped. Entries marked `REJECTED` never get a code.

### One-time setup

Zoho Marketing Automation (menu names may differ slightly):
- **Settings → Fields** (contact fields): add `Voucher Code` (text) and
  `Voucher Expiry` (text or date).
- Build the voucher email template. Insert the name and code from the **merge
  tag / personalization menu**. Do not type the tags by hand, or they arrive as
  raw text.

### Each batch (before each Zoho send)

```sql
-- 1. Exclude anything that should not get a code (spam, mistakes). Do this
--    before step 2: rejecting later does not take a code back.
update submissions set status = 'REJECTED' where email in ('...');

-- 2. Hand out the next codes, group by group. Returns how many were assigned.
select assign_pending_vouchers();

-- 3. The send list:
select * from voucher_send_list;
```

Run one batch a day: that keeps the "voucher within 48 hours" promise. One batch
covers every group, because email 03 is the same for all of them. Then send it
through Zoho Marketing Automation:

1. Download the step 3 result as CSV.
2. Zoho → **Contacts → Import** → upload the CSV and map the columns:

   | CSV column        | Zoho field     |
   |-------------------|----------------|
   | `email`           | Email          |
   | `full_name`       | First Name     |
   | `voucher_code`    | Voucher Code   |
   | `voucher_expires` | Voucher Expiry |

   Email 03 greets by First Name, so it shows the person's full name. The send
   list tidies it to First Letter Capital (`AHMAD FARHAN` becomes `Ahmad Farhan`),
   and `submissions` keeps it as typed. Leave `group_name` and the other columns
   unmapped.

   Add the contacts to a **new list for each batch**, e.g.
   `ZUS Voucher – Batch 1 (11 Nov)`, so nobody gets the email twice. Most people
   are already in Zoho, so choose the option that **updates existing contacts**,
   and check `Voucher Code` is filled before sending. If Zoho asks about consent
   / opt-in type, choose MYDATA's usual option (they agreed to the T&C on the
   form). If it shows a topic warning, tick **Map it to the selected topic**.
3. Create an email campaign from the voucher template. Recipients: **that
   batch list only**. Keep the header and footer theme off, and leave time for
   Zoho's compliance review. Send.
4. Open the campaign's send report and check for skipped or bounced contacts
   (see below).
5. Mark the batch as sent in Supabase:

```sql
update submissions set status = 'SENT', voucher_sent_at = now()
where status = 'PENDING' and voucher_code is not null;
```

6. Save the record (see [Keeping the record](#keeping-the-record)).

Do **not** run `assign_pending_vouchers()` between exporting the list and
marking it sent. Otherwise people assigned in between are marked SENT without
having been emailed.

`assign_pending_vouchers()` is safe to re-run: it only touches people without
a code, and stops quietly when a group's codes run out. `submissions_export`
still shows every entry with `email_count` / `phone_count` for review by hand.

### Skipped or bounced emails

- **Unsubscribed contacts are skipped.** Anyone who unsubscribed from an
  earlier MYDATA email does not get the Zoho campaign, but still holds a code.
  Send those codes by hand from Zoho Mail or Outlook.
- **Bounced emails** (typo in the address): the code is assigned but not
  delivered. Follow up by phone; the number is in `submissions`.

### When a group is full

```sql
select * from group_capacity;   -- limit, codes loaded, claimed, places
```

- **Spam counts until it is marked `REJECTED`.** Rejecting entries frees their
  places and reopens the group. If the entry already had a code, that code is
  used up: the place goes, and `codes_loaded` drops by one.
- **Loading more codes** or raising the limit reopens the group too.
- If the opening page's check fails (database glitch), the form stays open
  rather than closing by mistake. Submitting then shows "Something went wrong".

---

## Keeping the record

These are real claims, so **nothing gets deleted**. Never run `delete` on
`submissions` or `vouchers`.

- `submissions` holds who entered, when, with which group's code, which voucher
  they got, and when it was sent. `vouchers` shows who holds each code.
- A mistake is marked `REJECTED`, not deleted.
- After each batch, run this and download the result as CSV into
  `~/Documents/ZUS-private/`:

  ```sql
  select * from submissions_export;
  ```

  Don't count on Supabase backups on the free plan: this file is the backup. It
  holds personal data and real codes, so it stays out of this repository.

---

## Final MarComm test

The real test before the other groups: email 02, form, voucher batch, email 03.
MarComm's codes are real ZUS codes and go out for real, so these are real claims.

1. Check the Zoho list count for MarComm before sending.
2. Test send emails 02 and 03 to your own Gmail.
3. Send email 02 to the MarComm list.
4. Try one wrong code: it shows the error and stores nothing.
5. Each person enters MarComm's code, each with a different email and phone.
6. If everyone claims, one more try with new details shows "All vouchers have been
   claimed" and stores nothing. The opening page shows it too while MarComm is the
   only group loaded, and it reopens when the next group is loaded. `/terms` still
   opens.
7. Run [the batch](#each-batch-before-each-zoho-send) and send email 03.
8. Check each email shows the right name and code. Redeem at least one in the ZUS
   app.
9. [Save the record](#keeping-the-record). **Do not delete anything.**

MarComm's code stays active after the test, so a late MarComm person sees "All
vouchers have been claimed" rather than a wrong-code error.

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
- Turnstile does not stop real people who were forwarded the link, and a forwarded
  email carries a real referral code. The code check stops wrong codes, not
  forwarded ones. The group's limit caps that, and the export review is the
  safeguard.

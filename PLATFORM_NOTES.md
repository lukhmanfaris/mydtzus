# Platform notes — Cloudflare and Gmail

Research for two open questions, 19 September 2026. Findings only; both
decisions are still yours.

---

## 1. Cloudflare as the deployment platform

### The constraint that shapes everything

Workers is a **V8 isolate runtime, not Node**. Express does not run on it. Of
the current codebase, `server.ts` is the only file that would have to be
rewritten — and it is one file of routes.

That is a smaller job than it sounds, and deliberately so: `lib/` was written
during this audit to be framework-agnostic. `lib/security/rateLimit.ts` takes a
`headers`-or-`.get()` shape rather than an Express request, and `lib/data/*`,
`lib/auth/session.ts` and `lib/validation/*` have no Express dependency at all.
`src/` is a plain Vite SPA and ports as static assets untouched.

### What Cloudflare gives you that the current build lacks

**Native rate limiting.** The Workers Rate Limiting binding went GA in September
2025. `await env.LIMITER.limit({ key })` — no in-process Map, survives across
instances. This retires fix C3's home-grown limiter and the scaling caveat at
the bottom of `rateLimit.ts`.

Two caveats worth knowing before relying on it:
- Counters are **per colo**, not global. An attacker distributed across regions
  gets the limit multiplied by the number of colos they reach. Cloudflare
  describes it as "permissive, eventually consistent, and intentionally designed
  not to be used as an accurate accounting system."
- The docs explicitly advise against keying by IP, since mobile networks and
  privacy proxies share addresses. For a gate keyed on nothing else, IP is still
  the only option — so pair it with WAF rate limiting rules at the account level.

**Trustworthy client IP.** Inside a Worker, `CF-Connecting-IP` is set by
Cloudflare's own edge and cannot be spoofed by the client — which is exactly the
hole C3 patched. (The spoofing advisories you'll find concern *origin* servers
behind Cloudflare that remain directly reachable; that isn't the case for a
Worker.) Set `TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip`.

**Secrets.** `wrangler secret put SESSION_SECRET` — server-side, never in the
bundle.

### What does *not* change

The atomic draw stays in Postgres. `supabase-js` is `fetch`-based and works in
Workers, so `FOR UPDATE SKIP LOCKED` inside `draw_voucher_atomic` is untouched
by the platform choice. **This invariant survives any option below.**

> One trap worth naming: if Cloudflare tempts you toward **D1** instead of
> Supabase, D1 is SQLite and has no `SKIP LOCKED`. The whole concurrency
> guarantee would need redesigning, and two people could draw the same voucher.
> Keep Supabase.

### Next.js on Cloudflare, if you still want Next.js

Two paths, and this moved recently:

- **vinext** — Cloudflare's own Vite plugin that reimplements the Next.js API
  surface. Now the primary recommendation in their docs, targets Next.js 16, and
  is **in beta**. Cloudflare's own advice is to run their compatibility check
  before adopting it for an existing production app.
- **OpenNext** (`@opennextjs/cloudflare`) — the established adapter, positioned
  as the path for existing deployments.

Since you are not on Next.js today, adopting it *only* to then run it through a
beta adapter is two risks stacked to reach the same place.

### The four options

| | Platform | Work | Notes |
|---|---|---|---|
| **A** | Node host — Cloud Run, Render, Fly | **none** | Runs today. Cloud Run is where AI Studio already pointed it. Rate limiting stays in-process — single instance only. |
| **B** | **Cloudflare Workers + Hono** | rewrite `server.ts` | `lib/` and `src/` port as-is. Native rate limiting, trustworthy client IP, no Next.js anywhere. |
| **C** | Next.js + vinext/OpenNext on Cloudflare | full port | Beta adapter plus a framework migration, for no capability B doesn't have. |
| **D** | Next.js on Vercel | full port | What the handoff specifies. Matches the doc; largest rewrite. |

**My recommendation is B if Cloudflare is the goal.** The app is already an SPA
plus three thin API routes — the shape Workers is built for. Hono's routing is
close enough to Express that the port is mechanical, and you'd be deleting the
custom rate limiter rather than carrying it. Option A remains the right answer
if the priority is shipping Phase 1 for review this week; nothing about A blocks
a later move to B.

If you pick D, note it means reinstating the `app/api/*` route handlers that
were deleted as dead code — properly this time, with `server.ts` removed.

---

## 2. Gmail as the transactional sender

Short version: **usable for testing the send path, not for the campaign.**
Four constraints, in order of how hard they bite.

### It does not work from Cloudflare Workers

Workers has no `net` module, so Nodemailer and every SMTP library built on it
will not run. If you choose option B or C above, Gmail SMTP is off the table
entirely. The remaining Gmail route is the **Gmail API over HTTPS with OAuth2**
— a refresh token, a token exchange on every cold start, and a consent screen to
maintain. (TCP is technically reachable via `cloudflare:sockets`, and libraries
like `worker-mailer` use it, but STARTTLS to Gmail through that path is a
fragile thing to put a campaign on.)

### The volume ceiling may be below your recipient list

| Account | Limit |
|---|---|
| Free `@gmail.com` | **500 recipients/day**, rolling 24h |
| Google Workspace | **2,000 recipients/day** |

Google counts **recipients, not messages**. Recipient count is still open item 2
— if the list runs past 500, a free Gmail account cannot deliver the
transactional sends at all, and there is no headroom for retries.

### You cannot authenticate a brand domain

Google owns `gmail.com`, so you cannot publish SPF, DKIM or DMARC records for
it. Mail sent from a personal account inherits Google's authentication and will
pass — but it will pass *as that personal account*, never as ZUS or as your
campaign domain. Google's sender guidelines expect authentication from all
senders and require SPF + DKIM + DMARC alignment above 5,000/day to Gmail
addresses; a personal account cannot satisfy the alignment part for a brand.

### It looks like phishing

This is the one I'd weigh heaviest, and it isn't technical. A recipient gets a
marketing email from ZUS, clicks through, fills in a form — and the voucher
arrives from `someone@gmail.com`. That is the exact shape of a scam, and people
have been trained to distrust it. Expect deleted mail, spam reports that damage
the sending account, and support load on marketing.

### What to do instead

Open item 6 already named the low-friction options, and they still hold:

- **Resend** — domain-authenticated, HTTPS API, works from Node and Workers.
- **Cloudflare Email Service** — an `EMAIL` binding callable straight from a
  Worker (`await env.EMAIL.send({...})`). Currently **Beta**, Workers Paid plan,
  sends from your own verified domain. The natural pairing with option B.
- **Supabase Edge Function** — keeps the send next to the data.

All three need one thing Gmail cannot give you: a domain you control, with SPF,
DKIM and DMARC published. That is the real prerequisite, and it is worth
starting now — DNS propagation and domain warm-up are not same-day tasks.

Use Gmail to prove the send path works end to end. Do not point the campaign at
it.

> Separate matter: marketing's **announcement blast** goes out manually from
> Outlook and is explicitly out of scope (handoff §2). None of the above
> concerns it. This is only about the post-claim voucher delivery.

---

## Sources

- [Next.js · Cloudflare Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [OpenNext adapter · Cloudflare Workers docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Rate Limiting · Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Rate Limiting in Workers is now GA · Cloudflare Changelog](https://developers.cloudflare.com/changelog/post/2025-09-19-ratelimit-workers-ga/)
- [Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
- [Email sender guidelines · Gmail Help](https://support.google.com/mail/answer/81126?hl=en)
- [Email sender guidelines FAQ · Google Workspace Admin Help](https://support.google.com/a/answer/14229414?hl=en)
- [Gmail Sending Limits 2026 · Overloop](https://overloop.com/blog/gmail-sending-limits)
- [Why Nodemailer Doesn't Work on Cloudflare Workers · DEV](https://dev.to/gurusandeep/why-nodemailer-doesnt-work-on-cloudflare-workers-and-what-to-do-instead-358h)
- [worker-mailer · GitHub](https://github.com/zou-yu/worker-mailer)
- [Rate-limit bypass via CF-Connecting-IP header spoofing · GHSA](https://github.com/hedgedoc/hedgedoc/security/advisories/GHSA-2f9f-w8xq-276v)

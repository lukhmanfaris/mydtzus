import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { SubmissionSchema, toFieldErrors } from '../lib/validation/form.js';
import { getDataAdapter, type DataEnv } from '../lib/data/adapter.js';
import { verifyTurnstile } from '../lib/security/turnstile.js';

/**
 * API for the campaign form. Static assets (the React app) are served by
 * Workers Assets; only `/api/*` reaches this Worker (see `run_worker_first`
 * in wrangler.jsonc).
 */
interface Env extends DataEnv {
  SUBMIT_LIMITER: RateLimit;
  CAMPAIGN_END_ISO?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', secureHeaders());

/**
 * Closed when now ≥ CAMPAIGN_END_ISO. Blank means no closing date. An
 * unparseable value fails closed — a typo should be noticed on the first page
 * load after deploy, not discovered after the campaign was meant to end.
 */
function isClosed(env: Env): boolean {
  const raw = env.CAMPAIGN_END_ISO?.trim();
  if (!raw) return false;
  const endsAt = Date.parse(raw);
  if (Number.isNaN(endsAt)) {
    console.error(`CAMPAIGN_END_ISO is not a valid date: "${raw}". Treating campaign as closed.`);
    return true;
  }
  return Date.now() >= endsAt;
}

app.get('/api/config', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({
    closed: isClosed(c.env),
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY || null,
  });
});

app.post('/api/submit', async (c) => {
  if (isClosed(c.env)) {
    return c.json({ code: 'CLOSED', error: 'This campaign has ended.' }, 410);
  }

  // Set by Cloudflare's edge; a client cannot spoof it on a Worker.
  const ip = c.req.header('cf-connecting-ip') || 'unknown';

  const { success: withinLimit } = await c.env.SUBMIT_LIMITER.limit({ key: ip });
  if (!withinLimit) {
    return c.json(
      { code: 'RATE_LIMITED', error: 'Too many attempts. Please wait a minute and try again.' },
      429
    );
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ code: 'BAD_REQUEST', error: 'Invalid request.' }, 400);
  }

  // Validate before Turnstile: tokens are single-use, so a typo in the email
  // should not burn one.
  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        code: 'INVALID_FIELDS',
        error: 'Please check the highlighted fields.',
        fields: toFieldErrors(parsed.error),
      },
      400
    );
  }

  if (!c.env.TURNSTILE_SECRET_KEY) {
    console.error('TURNSTILE_SECRET_KEY is not set. Refusing submissions.');
    return c.json({ code: 'SERVER_ERROR', error: 'Something went wrong. Please try again later.' }, 500);
  }

  const human = await verifyTurnstile(
    (body as Record<string, unknown>).turnstileToken,
    c.env.TURNSTILE_SECRET_KEY,
    ip === 'unknown' ? undefined : ip
  );
  if (!human) {
    return c.json(
      { code: 'BOT_CHECK_FAILED', error: 'We could not verify you are human. Please try again.' },
      403
    );
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  try {
    await getDataAdapter(c.env).insertSubmission({
      referral_code: data.referralCode,
      full_name: data.fullName,
      phone: data.phone,
      email: data.email,
      company_name: data.companyName,
      // Both are literal `true` in the schema; the server stamps the time.
      terms_accepted_at: now,
      consent_at: now,
    });
  } catch (err) {
    console.error('Submission insert failed:', err);
    return c.json({ code: 'SERVER_ERROR', error: 'Something went wrong. Please try again.' }, 500);
  }

  return c.json({ ok: true }, 201);
});

app.all('/api/*', (c) => c.json({ code: 'NOT_FOUND', error: 'Not found.' }, 404));

export default app;

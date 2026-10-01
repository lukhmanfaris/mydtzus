/**
 * Loads .env into process.env. MUST stay the first import: ESM evaluates
 * imports in order, and several modules below read process.env while they are
 * being evaluated (DATA_SOURCE here, GLOBAL_VERIFY_FAILURE_LIMIT in
 * rateLimit.ts, NODE_ENV in session.ts). Move this line down and those read
 * undefined.
 *
 * Real environment variables always win — dotenv never overwrites one that is
 * already set, so hosting platforms that inject their own are unaffected.
 */
import 'dotenv/config';

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dataAdapter, AdapterError } from './lib/data/adapter.js';
import { mockStore } from './lib/data/mock.js';
import {
  signSession,
  verifySession,
  assertSessionSecretConfigured,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from './lib/auth/session.js';
import { ClaimFormSchema } from './lib/validation/form.js';
import {
  resolveClientIp,
  checkVerifyRateLimit,
  recordVerifyFailure,
} from './lib/security/rateLimit.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_SOURCE = (process.env.DATA_SOURCE || 'mock').toLowerCase().trim();
const IS_MOCK = DATA_SOURCE === 'mock';

/**
 * Dev-only test affordances. Hard-gated on BOTH conditions so a stray
 * DATA_SOURCE value in production cannot expose them.
 */
const DEV_TOOLS_ENABLED = IS_MOCK && !IS_PRODUCTION;

/** Adapt an Express request to the framework-agnostic shape rateLimit.ts wants. */
function toIpResolvable(req: express.Request) {
  return {
    headers: req.headers as Record<string, string | string[] | undefined>,
    socketRemoteAddress: req.socket?.remoteAddress ?? null,
  };
}

async function startServer() {
  /**
   * FIX C1 — fail at boot, not at the first user's verify attempt.
   * A deployment with no SESSION_SECRET must not start at all.
   */
  assertSessionSecretConfigured();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  /**
   * FIX C3 — `app.set('trust proxy', true)` was here, which tells Express to
   * believe any x-forwarded-for a client sends. IP resolution is now handled by
   * lib/security/rateLimit.ts, which trusts a forwarded header only when
   * TRUSTED_CLIENT_IP_HEADER explicitly names it.
   */
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * Public campaign configuration.
   *
   * FIX H7 — `dataSource` was returned here and used by the client to decide
   * whether to render the test-code panel. Both are gone: the client has no
   * business knowing which backend is live, and the UI must be identical in
   * both phases (spec §4).
   */
  app.get('/api/config', (_req, res) => {
    res.json({ campaignEndIso: process.env.CAMPAIGN_END_ISO || null });
  });

  /**
   * Current verification session.
   *
   * FIX H6 — this imported `mockStore` directly, reaching around the adapter
   * boundary. Under DATA_SOURCE=supabase it returned a fabricated recipient
   * with an empty name and a hardcoded VERIFIED status. It now goes through the
   * adapter, so it behaves identically in both phases.
   */
  app.get('/api/session', async (req, res) => {
    const session = verifySession(req.cookies[SESSION_COOKIE_NAME]);

    if (!session) {
      return res.status(401).json({ valid: false, error: 'Tiada sesi pengesahan aktif.' });
    }

    try {
      const recipient = await dataAdapter.getRecipientById(session.recipientId);

      if (!recipient) {
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
        return res.status(401).json({ valid: false, error: 'Tiada sesi pengesahan aktif.' });
      }

      // A CLAIMED recipient has no reason to be back on the form.
      if (recipient.status === 'CLAIMED') {
        return res.status(409).json({ valid: false, error: 'Kod ini telah pun digunakan.' });
      }

      return res.json({
        valid: true,
        recipient: {
          fullName: recipient.full_name,
          email: recipient.email,
          status: recipient.status,
        },
      });
    } catch (err) {
      console.error('[Session API Error]:', err);
      return res.status(500).json({ valid: false, error: 'Ralat pelayan.' });
    }
  });

  /**
   * POST /api/verify — spec §7.
   * Never includes the voucher code in any response.
   */
  app.post('/api/verify', async (req, res) => {
    // FIX C3 — resolved from the socket unless a trusted header is configured.
    const clientIp = resolveClientIp(toIpResolvable(req));
    const verdict = checkVerifyRateLimit(clientIp);

    if (!verdict.allowed) {
      return res.status(429).json({
        error: 'Terlalu banyak percubaan. Sila tunggu 10 minit sebelum mencuba lagi.',
      });
    }

    if (process.env.CAMPAIGN_END_ISO) {
      const deadline = new Date(process.env.CAMPAIGN_END_ISO).getTime();
      if (!Number.isNaN(deadline) && Date.now() > deadline) {
        return res.status(410).json({ error: 'Kempen telah tamat.' });
      }
    }

    const { accessCode } = req.body || {};

    // Generic failure for anything unknown or malformed — spec §9 requires that
    // "no such code" and "wrong format" be indistinguishable to the client.
    const genericInvalid = { error: 'Kod tidak sah. Sila semak semula e-mel anda.' };

    if (!accessCode || typeof accessCode !== 'string' || !accessCode.trim()) {
      recordVerifyFailure();
      return res.status(404).json(genericInvalid);
    }

    try {
      const recipient = await dataAdapter.getRecipientByCode(accessCode);

      if (!recipient) {
        recordVerifyFailure();
        return res.status(404).json(genericInvalid);
      }

      if (recipient.status === 'CLAIMED') {
        return res.status(409).json({ error: 'Kod ini telah pun digunakan.' });
      }

      // LOCKED → VERIFIED, or VERIFIED left as-is. Spec §5: re-enterable.
      const verified = await dataAdapter.markVerified(recipient.id);

      res.cookie(SESSION_COOKIE_NAME, signSession(verified.id), SESSION_COOKIE_OPTIONS);

      return res.json({
        ok: true,
        recipient: { fullName: verified.full_name, email: verified.email },
      });
    } catch (err) {
      console.error('[Verify API Error]:', err);
      return res.status(500).json({ error: 'Ralat pelayan. Sila cuba lagi sebentar lagi.' });
    }
  });

  /**
   * POST /api/claim — spec §7.
   * Session cookie only; the access code is never accepted in the body.
   */
  app.post('/api/claim', async (req, res) => {
    const session = verifySession(req.cookies[SESSION_COOKIE_NAME]);

    if (!session) {
      return res.status(401).json({
        error: 'Sesi pengesahan telah tamat. Sila masukkan semula kod akses anda.',
      });
    }

    const parsed = ClaimFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Maklumat borang tidak sah.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await dataAdapter.claimVoucher(session.recipientId, parsed.data);
      return res.json({ voucherCode: result.voucherCode, expiresAt: result.expiresAt });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === AdapterError.POOL_EXHAUSTED) {
        return res.status(503).json({
          error: 'Semua baucar telah habis ditebus. Harap maaf atas sebarang kesulitan.',
          code: 'POOL_EXHAUSTED',
        });
      }

      /**
       * FIX C2 — a session naming a recipient who never passed the gate.
       * Either a forged cookie or a stale one after a data reset. Clear it and
       * send them back to the gate.
       */
      if (message === AdapterError.NOT_VERIFIED || message === AdapterError.RECIPIENT_NOT_FOUND) {
        console.warn(
          `[Claim] Rejected unverified claim for recipient ${session.recipientId} (${message}).`
        );
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
        return res.status(403).json({
          error: 'Sesi pengesahan tidak sah. Sila masukkan semula kod akses anda.',
          code: 'NOT_VERIFIED',
        });
      }

      console.error('[Claim API Error]:', err);
      return res.status(500).json({
        error: 'Ralat semasa menebus baucar. Sila cuba lagi sebentar lagi.',
      });
    }
  });

  app.post('/api/session/clear', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  /**
   * FIX H7 — was gated on DATA_SOURCE alone, so it shipped to production.
   * Now requires mock mode AND a non-production build.
   */
  if (DEV_TOOLS_ENABLED) {
    app.post('/api/mock/reset', (_req, res) => {
      mockStore.reset();
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true, message: 'Mock data reset' });
    });
  }

  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Voucher redemption server on http://0.0.0.0:${PORT}  [${DATA_SOURCE}]`);

    /**
     * FIX H5 — the test access codes used to be hardcoded into GateScreen.tsx
     * and shipped inside the browser bundle. Spec §9 forbids rendering the code
     * list to the client under any condition, and §4 forbids a component
     * holding one. They are printed here, server-side, instead.
     */
    if (DEV_TOOLS_ENABLED) {
      console.log(
        [
          '',
          '  Phase 1 test codes (server console only — never sent to the browser):',
          '    TESTAA  LOCKED    happy path',
          '    TESTBB  VERIFIED  resume an abandoned form',
          '    TESTCC  CLAIMED   already-used rejection',
          '    TESTDD  LOCKED    second happy path',
          '    TESTEE  LOCKED    reaches pool exhaustion after 3 draws',
          '',
          '  Reset:  curl -X POST localhost:' + PORT + '/api/mock/reset',
          '',
        ].join('\n')
      );
    }
  });
}

startServer().catch((err) => {
  console.error('\nFailed to start server:\n', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});

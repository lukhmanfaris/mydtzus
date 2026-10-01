import crypto from 'crypto';

export interface SessionPayload {
  recipientId: string;
  iat: number;
  exp: number;
}

const COOKIE_NAME = 'v_session';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

/**
 * FIX C1 — Forgeable session / complete gate bypass.
 *
 * The previous implementation fell back to a hardcoded literal when
 * SESSION_SECRET was unset. Anyone holding the source could mint a valid
 * cookie for any recipient id and claim a voucher without ever entering an
 * access code. This was confirmed by exploit, not theory.
 *
 * There is now no fallback. A missing or weak secret is a fatal
 * misconfiguration and the process refuses to sign or verify anything.
 */
let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'SESSION_SECRET is not set. Refusing to sign or verify sessions with a default ' +
        'secret, because a known secret allows anyone to forge a verification cookie ' +
        'and claim a voucher without an access code. ' +
        'Generate one with:  openssl rand -base64 48'
    );
  }

  if (secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET is too short (${secret.trim().length} chars, minimum ${MIN_SECRET_LENGTH}). ` +
        'Generate one with:  openssl rand -base64 48'
    );
  }

  cachedSecret = secret.trim();
  return cachedSecret;
}

/**
 * Call once at boot so a misconfigured deployment fails immediately and
 * loudly, rather than at the first user's verify attempt.
 */
export function assertSessionSecretConfigured(): void {
  getSecret();
}

export function signSession(recipientId: string): string {
  const iat = Date.now();
  const exp = iat + TWO_HOURS_MS;
  const payload: SessionPayload = { recipientId, iat, exp };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (!payload.recipientId || typeof payload.recipientId !== 'string') return null;
    if (!payload.exp || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null; // expired

    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: TWO_HOURS_MS,
  path: '/',
};

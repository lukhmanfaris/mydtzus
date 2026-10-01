/**
 * FIX C3 — rate limit bypass via header spoofing.
 *
 * The previous limiter read `x-forwarded-for` straight off the request. That
 * header is attacker-controlled: rotating it gave unlimited verify attempts
 * against a small access-code space. Confirmed by exploit — 12 attempts with a
 * rotating header all returned 404 instead of 429.
 *
 * Two changes:
 *
 *  1. Forwarded headers are only trusted when the deployment explicitly names
 *     which header its proxy sets, via TRUSTED_CLIENT_IP_HEADER. With nothing
 *     configured, the socket address is used and forwarded headers are ignored.
 *     Safe by default; correct behind a proxy once configured.
 *
 *  2. A global failure ceiling backs up the per-IP limit, so an attacker who
 *     rotates real source addresses (botnet, proxy pool) still hits a wall.
 *     See the DoS trade-off noted on GLOBAL_FAILURE_LIMIT below.
 *
 * Deployment note — set TRUSTED_CLIENT_IP_HEADER to:
 *     cf-connecting-ip           on Cloudflare
 *     x-vercel-forwarded-for     on Vercel
 *     x-forwarded-for            behind your own trusted reverse proxy only
 * Leave it unset for direct-to-Node deployments.
 */

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 10; // per IP, per window — spec §9

/**
 * Ceiling on FAILED verifies across all clients in one window.
 *
 * Trade-off, stated plainly: this is the only defence against an attacker who
 * rotates genuine source IPs, but a determined attacker can also use it to lock
 * out legitimate users for up to one window. It is deliberately set far above
 * the plausible traffic of a campaign whose recipient list is in the hundreds —
 * only failures count, so real recipients entering correct codes never touch
 * it. Raise it if the recipient count grows (open item 2), or set
 * DISABLE_GLOBAL_VERIFY_CEILING=true to turn it off.
 */
const GLOBAL_FAILURE_LIMIT = Number(process.env.GLOBAL_VERIFY_FAILURE_LIMIT ?? 200);

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const perIpAttempts = new Map<string, RateLimitRecord>();
let globalFailures: RateLimitRecord = { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS };

/**
 * Minimal shape this module needs from a request. Kept framework-agnostic so
 * this file survives a port to Next.js route handlers or Cloudflare Workers.
 */
export interface IpResolvable {
  headers: Record<string, string | string[] | undefined> | { get(name: string): string | null };
  socketRemoteAddress?: string | null;
}

function readHeader(
  headers: IpResolvable['headers'],
  name: string
): string | null {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(n: string): string | null }).get(name);
  }
  const raw = (headers as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/**
 * Resolve the client IP without trusting anything the client can set.
 *
 * Returns null when no trustworthy address is available, in which case the
 * caller should treat every such request as one shared bucket rather than
 * silently letting them through unlimited.
 */
export function resolveClientIp(req: IpResolvable): string | null {
  const trustedHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();

  if (trustedHeader) {
    const value = readHeader(req.headers, trustedHeader);
    if (value) {
      // x-forwarded-for style headers are a comma-separated chain. When the
      // proxy is trusted, the client address is the FIRST entry it appended.
      const first = value.split(',')[0]?.trim();
      if (first) return first;
    }
    // Configured header absent: fall through to the socket rather than
    // trusting some other header an attacker could have supplied.
  }

  return req.socketRemoteAddress?.trim() || null;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Set when the global ceiling tripped rather than the per-IP limit. */
  global?: boolean;
}

/** Called once per verify attempt, before the access code is looked up. */
export function checkVerifyRateLimit(clientIp: string | null): RateLimitVerdict {
  const now = Date.now();

  if (!isGlobalCeilingOk(now)) {
    return { allowed: false, global: true };
  }

  // Requests with no trustworthy address share a single bucket. They are not
  // exempt from limiting.
  const key = clientIp ?? '__unresolved__';
  const record = perIpAttempts.get(key);

  if (!record || now > record.resetAt) {
    perIpAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_VERIFY_ATTEMPTS) {
    return { allowed: false };
  }

  record.count += 1;
  return { allowed: true };
}

/** Called after a verify attempt that did NOT match a live access code. */
export function recordVerifyFailure(): void {
  const now = Date.now();
  if (now > globalFailures.resetAt) {
    globalFailures = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return;
  }
  globalFailures.count += 1;
}

function isGlobalCeilingOk(now: number): boolean {
  if (process.env.DISABLE_GLOBAL_VERIFY_CEILING === 'true') return true;
  if (now > globalFailures.resetAt) return true;
  return globalFailures.count < GLOBAL_FAILURE_LIMIT;
}

/** Test helper. Not reachable from any route. */
export function __resetRateLimitState(): void {
  perIpAttempts.clear();
  globalFailures = { count: 0, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS };
}

/**
 * SCALING NOTE — this state is in-process memory.
 *
 * It is correct for a single instance and resets on deploy. It does NOT hold
 * across multiple instances or a serverless platform, where each instance keeps
 * its own counters and the effective limit multiplies by the instance count.
 *
 * Before Phase 2 goes live on more than one instance, back this with shared
 * state. On Cloudflare that is the native Rate Limiting binding
 * (`env.LIMITER.limit({ key })`, GA since Sept 2025) — note its counters are
 * per-colo, so treat it as a strong deterrent rather than an exact ledger.
 * Elsewhere, Upstash Redis or equivalent.
 */

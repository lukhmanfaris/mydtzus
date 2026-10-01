/**
 * Cloudflare Turnstile server-side check.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Fails closed: a missing token, a network error or an unexpected response all
 * count as "not human". Tokens are single-use and expire after 5 minutes, so
 * the form resets the widget after every failed submit.
 */
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(
  token: unknown,
  secret: string,
  remoteIp?: string
): Promise<boolean> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return false;
  }

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const outcome = (await res.json()) as { success?: boolean };
    return outcome.success === true;
  } catch (err) {
    console.error('Turnstile siteverify failed:', err);
    return false;
  }
}

/**
 * Field normalisation, applied server-side on the way into storage. The user is
 * never asked to reformat anything — `012-345 6789`, `+60123456789` and
 * `0123456789` all land as the same value, so the team's duplicate filter works.
 */

/** Result of a normalisation attempt. */
export type NormaliseResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/**
 * Malaysian phone number → `60XXXXXXXXX`.
 *
 *   1. Strip all non-digit characters
 *   2. Remove a leading `60` or a leading `0` if present
 *   3. Prepend `60`
 *
 * Accepts any common local format. Rejects only when the normalised result is
 * not 10–12 digits.
 *
 *   '012-345 6789'    → '60123456789'
 *   '+60 12 345 6789' → '60123456789'
 *   '0123456789'      → '60123456789'
 */
export function normalisePhone(input: string): NormaliseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'Please enter a valid phone number.' };
  }

  let digits = input.replace(/\D/g, '');

  if (digits.length === 0) {
    return { ok: false, reason: 'Please enter your phone number.' };
  }

  if (digits.startsWith('60')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  const normalised = `60${digits}`;

  if (normalised.length < 10 || normalised.length > 12) {
    return {
      ok: false,
      reason: 'Please enter a valid Malaysian phone number (e.g. 012-345 6789).',
    };
  }

  return { ok: true, value: normalised };
}

/** Email → trimmed and lowercased for storage. */
export function normaliseEmail(input: string): string {
  return String(input ?? '').trim().toLowerCase();
}

/** Collapse internal whitespace and trim. For names and free-text fields. */
export function normaliseText(input: string): string {
  return String(input ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Referral code → trimmed, whitespace removed, uppercased.
 * Any value is accepted; normalising only makes `zus 2026` and `ZUS2026` group
 * together when the team filters the export.
 */
export function normaliseReferralCode(input: string): string {
  return String(input ?? '').replace(/\s+/g, '').toUpperCase();
}

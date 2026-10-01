/**
 * FIX H3 / H4 — field normalisation.
 *
 * Handoff spec §8. The build validated the phone number with a loose regex and
 * stored whatever the user typed, so `012-345 6789`, `+60123456789` and
 * `0123456789` all landed in the database as three different strings for the
 * same person. Email was likewise stored with whatever casing was typed.
 *
 * Normalisation happens server-side, on the way into storage. The user is never
 * asked to reformat anything.
 */

/** Result of a normalisation attempt. */
export type NormaliseResult =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/**
 * Malaysian phone number → `60XXXXXXXXX`.
 *
 * Per spec §8:
 *   1. Strip all non-digit characters
 *   2. Remove a leading `60` or a leading `0` if present
 *   3. Prepend `60`
 *
 * Accepts any common local format. Rejects only when the normalised result is
 * not 10–12 digits.
 *
 *   '012-345 6789'  → '60123456789'
 *   '+60 12 345 6789' → '60123456789'
 *   '0123456789'    → '60123456789'
 */
export function normalisePhone(input: string): NormaliseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'Nombor telefon tidak sah.' };
  }

  // 1. Strip all non-digit characters
  let digits = input.replace(/\D/g, '');

  if (digits.length === 0) {
    return { ok: false, reason: 'Sila masukkan nombor telefon anda.' };
  }

  // 2. Remove a leading '60' or a leading '0' if present
  if (digits.startsWith('60')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // 3. Prepend '60'
  const normalised = `60${digits}`;

  // Reject only if the result is not 10-12 digits after normalisation
  if (normalised.length < 10 || normalised.length > 12) {
    return {
      ok: false,
      reason: 'Sila masukkan nombor telefon Malaysia yang sah (contoh: 012-345 6789).',
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
 * Access code → trimmed, uppercased.
 * Centralised so the gate, the adapters and any future import script all agree.
 */
export function normaliseAccessCode(input: string): string {
  return String(input ?? '').trim().toUpperCase();
}

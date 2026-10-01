import { z } from 'zod';
import { normalisePhone, normaliseEmail, normaliseText } from './normalise.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PENDING DECISION — form field set
 * ─────────────────────────────────────────────────────────────────────────────
 * Handoff spec §8 defines four required fields:
 *     Full name · Email · Phone · Company (Syarikat)
 *
 * This build shipped a different set:
 *     Full name · Phone · Email · State/Outlet (optional) · T&C checkbox
 *
 * `company` is absent; `stateOrOutlet` and `agreeTerms` are not in either spec.
 *
 * The field set is NOT changed here — that decision is still open. This file
 * matches what the UI currently renders so nothing breaks. When the decision is
 * made, this is the only place the contract changes:
 *
 *   • To follow spec §8 exactly:
 *       - add:    company: z.string().transform(normaliseText).pipe(
 *                          z.string().min(2, {...}).max(100, {...})),
 *       - remove: stateOrOutlet, agreeTerms
 *       - add a `Syarikat` input to src/components/FormScreen.tsx
 *       - drop the state <select> and the T&C checkbox from that file
 *
 *   • To keep both: add `company` above and leave the rest in place.
 *     Note §15 — every extra field widens the Verified-to-Submitted gap.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ClaimFormSchema = z.object({
  fullName: z
    .string()
    .transform(normaliseText)
    .pipe(
      z
        .string()
        .min(2, { message: 'Sila masukkan nama penuh yang sah (minimum 2 huruf).' })
        .max(100, { message: 'Nama terlalu panjang.' })
    ),

  /**
   * FIX H3 — normalised to `60XXXXXXXXX` before it reaches storage.
   * Any common local format is accepted and rewritten silently, per spec §8.
   */
  phone: z
    .string({ message: 'Sila masukkan nombor telefon anda.' })
    .superRefine((val, ctx) => {
      const result = normalisePhone(val);
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: result.reason });
      }
    })
    .transform((val) => {
      const result = normalisePhone(val);
      // superRefine has already rejected the invalid case; this is unreachable
      // on a successful parse, but keeps the transform total.
      return result.ok ? result.value : val;
    }),

  /** FIX H4 — lowercased on store, per spec §8. */
  email: z
    .string()
    .transform(normaliseEmail)
    .pipe(
      z
        .string()
        .email({ message: 'Sila masukkan alamat e-mel yang sah.' })
        .max(120, { message: 'Alamat e-mel terlalu panjang.' })
    ),

  // ── Not in either spec. Retained pending the field-set decision above. ──
  stateOrOutlet: z
    .string()
    .transform(normaliseText)
    .pipe(z.string().max(100))
    .optional()
    .default(''),

  agreeTerms: z.literal(true, {
    message: 'Sila tandakan persetujuan Terma & Syarat untuk meneruskan.',
  }),
});

export type ClaimFormInput = z.infer<typeof ClaimFormSchema>;

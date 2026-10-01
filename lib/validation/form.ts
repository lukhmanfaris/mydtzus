import { z } from 'zod';
import {
  normalisePhone,
  normaliseEmail,
  normaliseText,
  normaliseReferralCode,
} from './normalise.js';

/**
 * The campaign form contract. Used by the browser for instant feedback and by
 * the Worker as the authoritative check — one schema, so the two never drift.
 *
 * Field set (confirmed): Referral Code · Full Name · Phone · Email · Company Name,
 * plus two required tick boxes: data-collection consent and T&C acceptance.
 */
export const SubmissionSchema = z.object({
  /** Free text — a shared code we hand out, not validated against a list. */
  referralCode: z
    .string({ message: 'Please enter your referral code.' })
    .transform(normaliseReferralCode)
    .pipe(
      z
        .string()
        .min(1, { message: 'Please enter your referral code.' })
        .max(50, { message: 'Referral code is too long.' })
    ),

  fullName: z
    .string({ message: 'Please enter your full name.' })
    .transform(normaliseText)
    .pipe(
      z
        .string()
        .min(2, { message: 'Please enter your full name.' })
        .max(100, { message: 'Name is too long.' })
    ),

  /** Normalised to `60XXXXXXXXX` before it reaches storage. */
  phone: z
    .string({ message: 'Please enter your phone number.' })
    .superRefine((val, ctx) => {
      const result = normalisePhone(val);
      if (!result.ok) {
        ctx.addIssue({ code: 'custom', message: result.reason });
      }
    })
    .transform((val) => {
      const result = normalisePhone(val);
      // superRefine has already rejected the invalid case; this keeps the
      // transform total.
      return result.ok ? result.value : val;
    }),

  /** Lowercased on store. */
  email: z
    .string({ message: 'Please enter your email address.' })
    .transform(normaliseEmail)
    .pipe(
      z
        .email({ message: 'Please enter a valid email address.' })
        .max(120, { message: 'Email address is too long.' })
    ),

  companyName: z
    .string({ message: 'Please enter your company name.' })
    .transform(normaliseText)
    .pipe(
      z
        .string()
        .min(2, { message: 'Please enter your company name.' })
        .max(150, { message: 'Company name is too long.' })
    ),

  /** "I accept the Terms and Conditions." tick box on the form. */
  termsAccepted: z.literal(true, {
    message: 'Please accept the Terms and Conditions to continue.',
  }),

  /** Data-collection consent tick box on the form. */
  consent: z.literal(true, {
    message: 'Please agree to the data collection consent to continue.',
  }),
});

export type SubmissionInput = z.input<typeof SubmissionSchema>;
export type Submission = z.output<typeof SubmissionSchema>;

/** Field name → first error message. Shape shared by the API and the form. */
export type FieldErrors = Partial<Record<keyof SubmissionInput, string>>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof SubmissionInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Campaign content — the one file to edit for copy and imagery.
 *
 * Everything below is PLACEHOLDER until the campaign team supplies the final
 * wording. While `CONTENT_IS_DRAFT` is true the intro page shows a visible
 * "Draft" badge, so placeholder terms cannot go live unnoticed.
 */
export const CONTENT_IS_DRAFT = true;

/** Intro image. Drop the real file into /public and update the path. */
export const HERO_IMAGE = {
  src: '/campaign-hero.svg',
  alt: 'ZUS Coffee voucher campaign',
};

export interface TermsSection {
  title: string;
  points: string[];
}

/**
 * Terms & Conditions, one slide per section. Add or remove sections freely —
 * the slider, its counter and the Agree gate follow the array length.
 */
export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Campaign Period',
    points: [
      'The campaign runs from [start date] to [end date], Malaysia time.',
      'Submissions received after the closing date will not be accepted.',
    ],
  },
  {
    title: 'Eligibility',
    points: [
      'Open to recipients of the campaign email who hold a valid referral code.',
      '[Any age, residency or company-related eligibility conditions.]',
    ],
  },
  {
    title: 'How to Participate',
    points: [
      'Read and agree to these Terms & Conditions.',
      'Complete the form with accurate details and submit it once.',
      '[Any limit on entries per person.]',
    ],
  },
  {
    title: 'Voucher Delivery & Use',
    points: [
      'Your ZUS Coffee voucher code will be sent to the email address you submit, within 48 hours.',
      '[Voucher value, validity period and how to redeem it.]',
      'Vouchers are non-transferable and cannot be exchanged for cash.',
    ],
  },
  {
    title: 'Personal Data',
    points: [
      'Your details are collected only to run this campaign and deliver your voucher.',
      '[Data controller name, retention period and contact for data requests, per the PDPA 2010.]',
    ],
  },
];

/**
 * Campaign content — the one file to edit for copy, imagery and legal text.
 */

/**
 * Campaign visual on the first page — one image carrying all the branding
 * (MYDATA × ZUS logos, headline, artwork). Shown as a square, up to 672px
 * wide on desktop/tablet and full width on phones.
 *
 * Spec for replacements: 1:1 square, at least 1440 × 1440 px, transparent or
 * white background, logos/text at least 60px in from every edge. The current
 * file is the designer's original PNG, cropped losslessly to a square by
 * removing only empty transparent space above and below the artwork.
 */
export const HERO_IMAGE = {
  src: '/campaign-visual.png',
  // The words in the artwork, for screen readers and if the image fails to load.
  alt: 'MYDATA × ZUS Coffee — Your Free ZUS Drink Awaits. Fueled for the Next Lap, Brewtiful Rewards by MYDATA.',
  width: 4500,
  height: 4500,
  /** True only while a stand-in image is used; shows a "Draft" banner. */
  placeholder: false,
};

/**
 * Banner at the top of every page after the campaign page (T&C, form,
 * thank-you, closed). One image for all of them, shown at the page width with
 * a 2000:516 ratio: up to 672 × 173 on desktop/tablet, full width on phones.
 *
 * Supply: 2000 × 516 px PNG/JPG/WebP, logos/text at least 40px in from every
 * edge (corners are rounded on screen). Drop it into /public and update
 * `src`; the placeholder shows the spec until then.
 */
export const PAGE_BANNER = {
  src: '/page-banner.svg',
  alt: 'MYDATA × ZUS Coffee',
  width: 2000,
  height: 516,
};

export const TERMS_TITLE = 'Terms & Conditions';

export interface TermsSection {
  title: string;
  /** Rendered as 1.1, 1.2 … in order. */
  clauses: string[];
}

/**
 * Campaign T&C — Terms_and_Conditions_for_Zus_Redemption_LEGAL280926.docx,
 * tracked changes accepted, published verbatim (including clause 3.6).
 * PENDING final legal approval.
 */
const CAMPAIGN_TERMS: TermsSection[] = [
  {
    title: 'Eligibility',
    clauses: [
      'This ZUS Coffee Voucher Redemption Programme (“Programme”) is organised by MYDATA Analytics Sdn Bhd (“MYDATASSM”) and is open only to selected MYDATASSM users who have registered on the MYDATASSM portal or have directly engaged with any system or service provided by MYDATASSM (“Eligible User”).',
      'An Eligible User may be selected and invited by MYDATASSM to participate in the Programme. Participation is voluntary and each selected Eligible User may accept or decline the invitation. Selection shall be at the sole and absolute discretion of MYDATASSM and no Eligible User or any person claiming through or under an Eligible User shall be entitled to challenge, dispute or appeal the selection.',
      'A selected Eligible User who declines the invitation will no longer be eligible to participate in this Programme.',
      'A selected Eligible User who accepts the invitation and participates in the Programme shall be referred to as a “Participant”. By accepting the invitation and participating in the Programme, the Participant shall be deemed to have read, understood and agreed to  be bound by these Terms & Conditions.',
    ],
  },
  {
    title: 'Participation & Content Requirements',
    clauses: [
      'Upon successful redemption of the ZUS Coffee voucher, each Participant is encouraged, but not required, to post at least one (1) photo and/or video of the redeemed ZUS Coffee beverage on the Participant’s public Instagram account feed. Posts made through Instagram Stories shall not qualify for the purposes of the Programme. The Participant is also encouraged to tag MYDATASSM’s Instagram account and/or use any designated  Programme hashtag, where applicable.',
      'Where a Participant chooses to post the photo or video pursuant to Clause 2.1, the post shall remain publicly accessible on the relevant Instagram account feed until the Completion of the Programme and shall not be deleted, hidden, archived, made private or otherwise removed during such period. For the avoidance of the doubt, “Completion of the Programme” means the date on which MYDATASSM announces the recipient of the additional gift or prize under Clause 2.3.',
      'Subject to MYDATASSM’s sole and absolute decision, only posts made in accordance with Clauses 21. And 2.2 shall be eligible for consideration for any additional gift or prize under the Programme, which may be awarded to the Participant whose eligible post receives the highest number of likes. Details of such additional gift or prize shall be determined and announced by MYDATASSM in due course.',
      'By posting a photo or video, each Participant grants MYDATASSM a non-exclusive, royalty-free right to access, retain, reproduce, publish, edit, adapt and use the posted content for purposes including marketing, promotion, branding and communication, across MYDATASSM’s digital and offline channels, including after the Programme has ended, subject to applicable laws and MYDATASSM’s applicable policies. MYDATASSM may request the Participant to provide a copy of the posted content, where reasonably required.',
      'Each Participant shall ensure that the posted content does not infringe any third party intellectual property, privacy, image, publicity or other proprietary rights, and does not contain any unlawful, offensive, defamatory or inappropriate material. The Participant shall indemnify MYDATASSM against any claim, complaint, loss, damage or liability arising from or in connection with the Participant’s breach of this Clause 2.5.',
    ],
  },
  {
    title: 'Voucher Redemption Process',
    clauses: [
      'Each Participant will be provided with a unique ZUS Coffee voucher code upon confirming their participation in the Programme.',
      'Each Participant must have an active ZUS Coffee mobile application installed on their device in order to redeem the voucher.',
      'The voucher is valid for the redemption of one (1) drink from the ZUS Coffee Classic Series only, subject to availability and any applicable terms imposed by ZUS Coffee.',
      'Each Participant may purchase additional items, add-ons or upgrades at their own expense. Any additional charges incurred will be borne entirely by the Participant.',
      'Each voucher code is valid for one-time use only and shall become invalid upon successful redemption.',
      'In the event that a Participant is unable to redeem the voucher due to any technical, system, application, outlet, availability or other issue beyond MYDATASSM’s reasonable control, MYDATASSM shall not be responsible for such unsuccessful redemption. The Participant may notify MYDATASSM of the issue for verification, and MYDATASSM may, at its sole discretion, determine the appropriate course of action, if any.',
    ],
  },
  {
    title: 'Redemption Period & Voucher Conditions',
    clauses: [
      'The redemption period is valid from 10 October 2026 to 10 November 2026 (“Redemption Period”).',
      'Voucher codes must be redeemed within the Redemption Period. Any voucher code not redeemed before the expiry of the Redemption Period shall automatically expire and shall not be replaced, extended or exchanged for cash, unless otherwise determined by MYDATASSM.',
      'Each voucher code is uniquely assigned to the respective Participant and is strictly non-transferable and may only be used by that Participant.',
      'A Participant shall not sell, exchange, share or transfer their voucher code to any other person.',
      'MYDATASSM reserves the right to disqualify a Participant or withdraw the Participant\'s eligibility to participate in the Programme if the Participant is found to have breached these Terms & Conditions or misused any voucher code.',
    ],
  },
  {
    title: 'General',
    clauses: [
      'MYDATASSM reserves the right to amend, suspend or terminate the Programme or amend any of these Terms & Conditions at any time where reasonably necessary.',
      'MYDATASSM\'s decision on all matters relating to the Prorgramme shall be final and conclusive.',
    ],
  },
];

export interface TermsDocument {
  /** Short label for the tab. */
  tab: string;
  title: string;
  subtitle?: string;
  /** One slide per section, clauses numbered 1.1, 1.2 … within the document. */
  sections: TermsSection[];
  /** Stand-in text; shows a draft banner on the T&C page while any remain. */
  placeholder?: boolean;
}

/**
 * The documents on page 2, in tab order. All must be read to the last section
 * before "I Agree" unlocks; one agreement covers all of them.
 * Which documents these are is still to be confirmed by legal.
 */
export const TERMS_DOCUMENTS: TermsDocument[] = [
  {
    tab: 'Campaign T&C',
    title: 'Terms & Conditions',
    subtitle: 'ZUS Coffee Voucher Redemption Programme',
    sections: CAMPAIGN_TERMS,
  },
  {
    tab: 'Document 2',
    title: 'Document 2 — title pending',
    placeholder: true,
    sections: [
      {
        title: 'Pending legal approval',
        clauses: ['The final wording of this document will be supplied by legal.'],
      },
    ],
  },
  {
    tab: 'Document 3',
    title: 'Document 3 — title pending',
    placeholder: true,
    sections: [
      {
        title: 'Pending legal approval',
        clauses: ['The final wording of this document will be supplied by legal.'],
      },
    ],
  },
];

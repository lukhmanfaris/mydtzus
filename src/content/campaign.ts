/**
 * Campaign content — the one file to edit for copy, imagery and legal text.
 */

/**
 * Campaign visual on the first page — one image carrying all the branding
 * (logo, headline, artwork). Shown at 4:5 portrait, up to 672px wide on
 * desktop/tablet and full width on phones.
 *
 * Supply: 1440 × 1800 px (4:5), JPG or WebP, ideally under 500 KB.
 * Minimum 1080 × 1350 px. Corners are rounded by 20px on screen, so keep
 * text and logos at least 60px in from every edge.
 *
 * Drop the file into /public, update `src`, and set `placeholder: false` to
 * remove the draft banner.
 */
export const HERO_IMAGE = {
  src: '/campaign-hero.svg',
  alt: 'ZUS Coffee Voucher Redemption Programme',
  width: 1440,
  height: 1800,
  placeholder: true,
};

/** Official MYDATA documents linked from the form's consent box. */
export const PRIVACY_POLICY_URL = 'https://www.mydata-ssm.com.my/policy';
export const PDPA_NOTICE_URL = 'https://www.mydata-ssm.com.my/pdpa';

export const TERMS_TITLE = 'Terms & Conditions';
export const TERMS_SUBTITLE = 'ZUS Coffee Voucher Redemption Programme';

export interface TermsSection {
  title: string;
  /** Rendered as 1.1, 1.2 … in order. */
  clauses: string[];
}

/**
 * Terms & Conditions — Terms_and_Conditions_for_Zus_Redemption_LEGAL280926.docx,
 * tracked changes accepted, published verbatim (including clause 3.6).
 * One slide per section; the slider follows the array length.
 */
export const TERMS_SECTIONS: TermsSection[] = [
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

import React from 'react';

export type ClosedReason = 'ended' | 'full';

const COPY: Record<ClosedReason, { title: string; body: string }> = {
  // CAMPAIGN_END_ISO has passed.
  ended: {
    title: 'This campaign has ended',
    body: 'Thank you for your interest. Submissions are no longer being accepted.',
  },
  // Every loaded voucher code has a person waiting for it.
  full: {
    title: 'All vouchers have been claimed',
    body: 'Thank you for your interest. All ZUS Coffee vouchers for this programme have been claimed.',
  },
};

export const Closed: React.FC<{ reason: ClosedReason }> = ({ reason }) => (
  <div className="w-full px-4 py-16 text-center">
    <h1 className="text-[28px] font-bold tracking-tight mb-2 leading-tight">{COPY[reason].title}</h1>
    <p className="text-[15px] text-[#86868b] leading-relaxed">{COPY[reason].body}</p>
  </div>
);

import React from 'react';

/** Shown once CAMPAIGN_END_ISO has passed. */
export const Closed: React.FC = () => (
  <div className="w-full px-4 py-16 text-center">
    <h1 className="text-[28px] font-bold tracking-tight mb-2 leading-tight">This campaign has ended</h1>
    <p className="text-[15px] text-[#86868b] leading-relaxed">
      Thank you for your interest. Submissions are no longer being accepted.
    </p>
  </div>
);

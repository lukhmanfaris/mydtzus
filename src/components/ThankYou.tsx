import React from 'react';

interface ThankYouProps {
  email: string;
}

/** Page 3 — confirmation. Vouchers are sent by the team, not shown here. */
export const ThankYou: React.FC<ThankYouProps> = ({ email }) => (
  <div className="w-full px-4 py-12 text-center">
    <div className="w-14 h-14 mx-auto mb-5 bg-[#1d1d1f] rounded-full flex items-center justify-center text-white">
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
      </svg>
    </div>

    <h1 className="text-[28px] font-bold tracking-tight mb-2 leading-tight">
      Thank you for participating!
    </h1>
    <p className="text-[15px] text-[#86868b] leading-relaxed mb-8">
      Your submission has been received.
    </p>

    <div className="rounded-[20px] bg-[#f5f5f7] p-5 text-left">
      <p className="text-[15px] leading-relaxed">
        Kindly allow up to <strong>48 hours</strong> for your ZUS Coffee voucher code to be delivered
        to <strong className="break-all">{email}</strong>.
      </p>
      <p className="mt-3 text-[13px] text-[#86868b] leading-relaxed">
        Don't see it? Check your spam or promotions folder.
      </p>
    </div>
  </div>
);

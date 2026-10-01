import React from 'react';
import { HERO_IMAGE } from '../content/campaign.js';

interface CampaignProps {
  onParticipate: () => void;
}

/** Page 1 — the campaign image and the call to action. */
export const Campaign: React.FC<CampaignProps> = ({ onParticipate }) => (
  <div className="w-full px-4 py-2">
    {HERO_IMAGE.placeholder && (
      <p className="mb-4 rounded-[12px] border border-[#f5d38a] bg-[#fff8e6] px-3 py-2 text-center text-[12px] font-medium text-[#8a5a00]">
        Draft — campaign image is a placeholder.
      </p>
    )}

    <img src={HERO_IMAGE.src} alt={HERO_IMAGE.alt} className="w-full rounded-[20px] object-cover" />

    <button
      type="button"
      onClick={onParticipate}
      className="mt-6 w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] active:bg-black text-white text-[16px] font-medium rounded-[980px] transition cursor-pointer"
    >
      Participate
    </button>
  </div>
);

import React from 'react';
import { HERO_IMAGE } from '../content/campaign.js';

interface CampaignProps {
  onParticipate: () => void;
}

/**
 * Width of the 4:5 visual: the full column on phones, 672px at most on
 * desktop/tablet, and never so tall that the Participate button drops below
 * the fold (the 220px covers the button, spacing and footer).
 */
const VISUAL_WIDTH = 'min(100%, 672px, max(240px, calc((100svh - 220px) * 0.8)))';

/** Page 1 — the campaign visual (which carries the branding) and the call to action. */
export const Campaign: React.FC<CampaignProps> = ({ onParticipate }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
    <div className="flex flex-col items-center gap-6" style={{ width: VISUAL_WIDTH }}>
      {HERO_IMAGE.placeholder && (
        <p className="w-full rounded-[12px] border border-[#f5d38a] bg-[#fff8e6] px-3 py-2 text-center text-[12px] font-medium text-[#8a5a00]">
          Draft — campaign image is a placeholder.
        </p>
      )}

      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        width={HERO_IMAGE.width}
        height={HERO_IMAGE.height}
        className="w-full aspect-[4/5] rounded-[20px] object-cover"
      />

      <button
        type="button"
        onClick={onParticipate}
        className="w-full h-[52px] bg-[#e22000] hover:bg-[#c41c00] active:bg-[#a81800] text-white text-[17px] font-semibold rounded-[980px] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e22000]"
      >
        Participate
      </button>
    </div>
  </div>
);

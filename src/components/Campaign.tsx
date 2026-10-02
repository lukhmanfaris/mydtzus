import React from 'react';
import { HERO_IMAGE } from '../content/campaign.js';
import { PrimaryButton } from './PrimaryButton.js';

interface CampaignProps {
  onParticipate: () => void;
}

/**
 * Width (= height) of the square visual: the full column on phones, 672px at
 * most on desktop/tablet, and never so tall that the Participate button drops
 * below the fold (the 220px covers the button, spacing and footer).
 */
const VISUAL_WIDTH = 'min(100%, 672px, max(240px, calc(100svh - 220px)))';

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
        className="w-full aspect-square rounded-[20px] object-cover"
      />

      <PrimaryButton onClick={onParticipate}>Let's Go!</PrimaryButton>
    </div>
  </div>
);

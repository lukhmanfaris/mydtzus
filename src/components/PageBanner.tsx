import React from 'react';
import { PAGE_BANNER } from '../content/campaign.js';

/** The 3:1 image at the top of every page after the campaign page. */
export const PageBanner: React.FC = () => (
  <header className="w-full px-4 pt-6 pb-4">
    <img
      src={PAGE_BANNER.src}
      alt={PAGE_BANNER.alt}
      width={PAGE_BANNER.width}
      height={PAGE_BANNER.height}
      className="w-full aspect-[3/1] rounded-[16px] object-cover"
    />
  </header>
);

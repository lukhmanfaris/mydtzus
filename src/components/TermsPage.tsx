import React, { useEffect } from 'react';
import { TERMS_SECTIONS, TERMS_SUBTITLE, TERMS_TITLE } from '../content/campaign.js';
import { PageBanner } from './PageBanner.js';
import { PageFooter } from './PageFooter.js';
import { ClauseList } from './Terms.js';

/**
 * /terms — the T&C as one page to read, linked from the campaign emails. It
 * makes no API call on purpose: it must keep working after the form closes or
 * every voucher has been claimed, because the voucher email links here.
 */
export const TermsPage: React.FC = () => {
  useEffect(() => {
    document.title = `${TERMS_TITLE} | ${TERMS_SUBTITLE}`;
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex flex-col items-center font-sans">
      <div className="w-full max-w-[704px] flex flex-col flex-1 pb-12">
        <PageBanner />
        <main className="w-full flex-1 px-4 py-2">
          <h1 className="text-[26px] font-bold tracking-tight text-center leading-tight">
            {TERMS_TITLE}
          </h1>
          <p className="mt-1 mb-6 text-center text-[15px] font-medium">{TERMS_SUBTITLE}</p>

          <div className="space-y-4">
            {TERMS_SECTIONS.map((section, s) => (
              <section key={section.title} className="rounded-[20px] bg-[#f5f5f7] p-5">
                <h2 className="mb-3 text-[18px] font-semibold">
                  {s + 1}. {section.title}
                </h2>
                <ClauseList sectionNumber={s + 1} clauses={section.clauses} />
              </section>
            ))}
          </div>
        </main>
      </div>
      <PageFooter />
    </div>
  );
};

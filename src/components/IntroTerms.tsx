import React, { useRef, useState } from 'react';
import { CONTENT_IS_DRAFT, HERO_IMAGE, TERMS_SECTIONS } from '../content/campaign.js';

interface IntroTermsProps {
  onAgree: () => void;
}

/**
 * Page 1 — campaign image, then the T&C as swipeable slides. "I Agree" unlocks
 * only once the reader has reached the last slide.
 */
export const IntroTerms: React.FC<IntroTermsProps> = ({ onAgree }) => {
  const termsRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(TERMS_SECTIONS.length <= 1);

  const total = TERMS_SECTIONS.length;
  const isLast = index === total - 1;

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(total - 1, i));
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
  };

  // Swipes and button presses both land here via the scroll position.
  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) setIndex(i);
    if (i === total - 1) setReachedEnd(true);
  };

  return (
    <div className="w-full px-4 py-2">
      {CONTENT_IS_DRAFT && (
        <p className="mb-4 rounded-[12px] border border-[#f5d38a] bg-[#fff8e6] px-3 py-2 text-center text-[12px] font-medium text-[#8a5a00]">
          Draft content — campaign image and terms are placeholders.
        </p>
      )}

      <img
        src={HERO_IMAGE.src}
        alt={HERO_IMAGE.alt}
        className="w-full rounded-[20px] object-cover"
      />

      <button
        type="button"
        onClick={() => termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="mt-6 w-full h-[50px] rounded-[980px] border border-[#1d1d1f] text-[16px] font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7] cursor-pointer"
      >
        Next: Terms &amp; Conditions
      </button>

      <section
        ref={termsRef}
        aria-labelledby="terms-heading"
        className="mt-12 scroll-mt-6"
      >
        <h2 id="terms-heading" className="text-[24px] font-bold tracking-tight text-center">
          Terms &amp; Conditions
        </h2>
        <p className="mt-1 mb-5 text-center text-[14px] text-[#86868b]">
          Swipe or tap Next to read all {total} sections.
        </p>

        <div
          ref={trackRef}
          onScroll={handleScroll}
          role="region"
          aria-roledescription="carousel"
          aria-label="Terms and Conditions"
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {TERMS_SECTIONS.map((section, i) => (
            <article
              key={section.title}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${total}`}
              className="w-full shrink-0 snap-center px-0.5"
            >
              <div className="h-full rounded-[20px] bg-[#f5f5f7] p-5">
                <p className="text-[12px] font-medium uppercase tracking-wider text-[#86868b]">
                  Section {i + 1} of {total}
                </p>
                <h3 className="mt-1 mb-3 text-[18px] font-semibold">{section.title}</h3>
                <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-[#1d1d1f]">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="h-[40px] px-4 rounded-[980px] text-[15px] font-medium text-[#1d1d1f] disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            Back
          </button>

          <div className="flex gap-1.5" aria-hidden="true">
            {TERMS_SECTIONS.map((section, i) => (
              <span
                key={section.title}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-[#1d1d1f]' : 'w-1.5 bg-[#d2d2d7]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={isLast}
            className="h-[40px] px-4 rounded-[980px] text-[15px] font-medium text-[#1d1d1f] disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            Next
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          Section {index + 1} of {total}: {TERMS_SECTIONS[index]?.title}
        </p>

        <button
          type="button"
          onClick={onAgree}
          disabled={!reachedEnd}
          className="mt-8 w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] active:bg-black text-white text-[16px] font-medium rounded-[980px] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          I Agree
        </button>
        <p className="mt-3 text-center text-[13px] text-[#86868b]">
          {reachedEnd
            ? 'By tapping I Agree, you confirm you have read and accept the Terms & Conditions.'
            : 'Read through to the last section to continue.'}
        </p>
      </section>
    </div>
  );
};

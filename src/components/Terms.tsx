import React, { useLayoutEffect, useRef, useState } from 'react';
import { TERMS_SECTIONS, TERMS_SUBTITLE, TERMS_TITLE } from '../content/campaign.js';

interface TermsProps {
  /** Already reached the last slide earlier, e.g. coming back from the form. */
  alreadyRead: boolean;
  onAgree: () => void;
}

/**
 * Page 2 — the T&C as swipeable slides, one per section. "I Agree" unlocks
 * only once the reader has reached the last slide.
 */
export const Terms: React.FC<TermsProps> = ({ alreadyRead, onAgree }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [reachedEnd, setReachedEnd] = useState(alreadyRead || TERMS_SECTIONS.length <= 1);

  const total = TERMS_SECTIONS.length;
  const isLast = index === total - 1;

  // Size the track to the slide in view, so a short section doesn't leave the
  // height of the longest one as empty space above the controls.
  useLayoutEffect(() => {
    const slide = slideRefs.current[index];
    if (!slide) return;
    const update = () => setHeight(slide.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(slide);

    // Tapping Next at the bottom of a long section would otherwise leave the
    // start of the next one above the screen.
    const top = trackRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollBy({ top: top - 16, behavior: 'smooth' });

    return () => observer.disconnect();
  }, [index]);

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
    <section aria-labelledby="terms-heading" className="w-full px-4 py-2">
      <h1 id="terms-heading" className="text-[26px] font-bold tracking-tight text-center leading-tight">
        {TERMS_TITLE}
      </h1>
      <p className="mt-1 text-center text-[15px] font-medium">{TERMS_SUBTITLE}</p>
      <p className="mt-1 mb-5 text-center text-[13px] text-[#86868b]">
        Swipe or tap Next to read all {total} sections.
      </p>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        role="region"
        aria-roledescription="carousel"
        aria-label="Terms and Conditions"
        style={{ height }}
        className="no-scrollbar flex items-start snap-x snap-mandatory overflow-x-auto overflow-y-hidden transition-[height] duration-300"
      >
        {TERMS_SECTIONS.map((section, s) => (
          <article
            key={section.title}
            ref={(el) => {
              slideRefs.current[s] = el;
            }}
            aria-roledescription="slide"
            aria-label={`${s + 1} of ${total}`}
            className="w-full shrink-0 snap-center px-0.5"
          >
            <div className="rounded-[20px] bg-[#f5f5f7] p-5">
              <p className="text-[12px] font-medium uppercase tracking-wider text-[#86868b]">
                Section {s + 1} of {total}
              </p>
              <h2 className="mt-1 mb-3 text-[18px] font-semibold">
                {s + 1}. {section.title}
              </h2>
              <ol className="space-y-3 text-[14px] leading-relaxed">
                {section.clauses.map((clause, c) => (
                  <li key={c} className="flex gap-2.5">
                    <span className="shrink-0 font-medium tabular-nums text-[#86868b]">
                      {s + 1}.{c + 1}
                    </span>
                    <span>{clause}</span>
                  </li>
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
          className="h-[40px] px-4 rounded-[980px] text-[15px] font-medium disabled:opacity-30 cursor-pointer disabled:cursor-default"
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
          className="h-[40px] px-4 rounded-[980px] text-[15px] font-medium disabled:opacity-30 cursor-pointer disabled:cursor-default"
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
  );
};

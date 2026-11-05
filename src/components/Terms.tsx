import React, { useLayoutEffect, useRef, useState } from 'react';
import { TERMS_SECTIONS, TERMS_SUBTITLE, TERMS_TITLE } from '../content/campaign.js';
import { PrimaryButton } from './PrimaryButton.js';

interface TermsProps {
  /** Already read to the end earlier, e.g. coming back from the form. */
  alreadyRead: boolean;
  onAgree: () => void;
}

/** Splits text on web addresses so they can be shown as links. A trailing
 *  bracket or full stop belongs to the sentence, not the address. */
const URL_PATTERN = /(https?:\/\/[^\s)]*[^\s).,;])/g;

const ClauseText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(URL_PATTERN).map((part, i) =>
      i % 2 === 1 ? (
        // New tab, so reading position and agreement progress are not lost.
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 break-all"
        >
          {part}
        </a>
      ) : (
        part
      )
    )}
  </>
);

/** One section's clauses, numbered 1.1, 1.2 … Shared with the /terms page. */
export const ClauseList: React.FC<{ sectionNumber: number; clauses: string[] }> = ({
  sectionNumber,
  clauses,
}) => (
  <ol className="space-y-3 text-[14px] leading-relaxed">
    {clauses.map((clause, c) => (
      <li key={c} className="flex gap-2.5">
        <span className="shrink-0 font-medium tabular-nums text-[#86868b]">
          {sectionNumber}.{c + 1}
        </span>
        <span className="min-w-0">
          <ClauseText text={clause} />
        </span>
      </li>
    ))}
  </ol>
);

/**
 * Page 2 — the Terms & Conditions as swipeable slides, one per section.
 * "I Agree" unlocks only once the reader has reached the last section.
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

    if (index === total - 1) setReachedEnd(true);
    return () => observer.disconnect();
  }, [index, total]);

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
        aria-label={TERMS_TITLE}
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
              <ClauseList sectionNumber={s + 1} clauses={section.clauses} />
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

      <PrimaryButton onClick={onAgree} disabled={!reachedEnd} className="mt-8">
        I Agree
      </PrimaryButton>
      <p className="mt-3 text-center text-[13px] text-[#86868b]" aria-live="polite">
        {reachedEnd
          ? 'By tapping I Agree, you confirm you have read and accept the Terms & Conditions.'
          : 'Read through to the last section to continue.'}
      </p>
    </section>
  );
};

import React, { useLayoutEffect, useRef, useState } from 'react';
import { TERMS_DOCUMENTS, TERMS_TITLE, type TermsDocument } from '../content/campaign.js';
import { PrimaryButton } from './PrimaryButton.js';

interface TermsProps {
  /** All documents already read earlier, e.g. coming back from the form. */
  alreadyRead: boolean;
  onAgree: () => void;
}

/**
 * Page 2 — every T&C document, one tab each, each document's sections as
 * swipeable slides. A single "I Agree" covers all documents and unlocks only
 * once each one has been read to its last section.
 */
export const Terms: React.FC<TermsProps> = ({ alreadyRead, onAgree }) => {
  const total = TERMS_DOCUMENTS.length;
  const [active, setActive] = useState(0);
  // A document counts as read once its last section has been on screen (a
  // one-section document as soon as its tab is opened).
  const [read, setRead] = useState<boolean[]>(() => TERMS_DOCUMENTS.map(() => alreadyRead));
  const allRead = read.every(Boolean);
  const unread = read.filter((r) => !r).length;
  const hasPlaceholder = TERMS_DOCUMENTS.some((doc) => doc.placeholder);

  const markRead = (i: number) =>
    setRead((prev) => (prev[i] ? prev : prev.map((r, j) => (j === i ? true : r))));

  return (
    <section aria-labelledby="terms-heading" className="w-full px-4 py-2">
      {hasPlaceholder && (
        <p className="mb-4 rounded-[12px] border border-[#f5d38a] bg-[#fff8e6] px-3 py-2 text-center text-[12px] font-medium text-[#8a5a00]">
          Draft — some documents are placeholders pending legal approval.
        </p>
      )}

      <h1 id="terms-heading" className="text-[26px] font-bold tracking-tight text-center leading-tight">
        {TERMS_TITLE}
      </h1>
      <p className="mt-1 mb-5 text-center text-[13px] text-[#86868b]">
        Please read all {total} documents. Swipe or tap Next within each one.
      </p>

      <div role="tablist" aria-label="Documents" className="mb-4 flex gap-1 rounded-[14px] bg-[#f5f5f7] p-1">
        {TERMS_DOCUMENTS.map((doc, i) => (
          <button
            key={doc.tab}
            type="button"
            role="tab"
            id={`terms-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`terms-panel-${i}`}
            onClick={() => setActive(i)}
            className={`flex-1 min-w-0 rounded-[10px] px-2 py-2 text-[13px] font-medium leading-tight transition cursor-pointer ${
              i === active ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#6e6e73]'
            }`}
          >
            <span className="block">
              {read[i] && (
                <span aria-label="read" className="mr-1 text-[#1f8a3b]">
                  ✓
                </span>
              )}
              {doc.tab}
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`terms-panel-${active}`} aria-labelledby={`terms-tab-${active}`}>
        {/* Remount per document so each starts at its first section. */}
        <DocumentSlides
          key={active}
          doc={TERMS_DOCUMENTS[active]}
          onReachedEnd={() => markRead(active)}
          onNextDocument={active < total - 1 ? () => setActive(active + 1) : undefined}
        />
      </div>

      <PrimaryButton onClick={onAgree} disabled={!allRead} className="mt-8">
        I Agree
      </PrimaryButton>
      <p className="mt-3 text-center text-[13px] text-[#86868b]" aria-live="polite">
        {allRead
          ? `By tapping I Agree, you confirm you have read and accept all ${total} documents.`
          : `Read every document to the end to continue (${unread} left).`}
      </p>
    </section>
  );
};

interface DocumentSlidesProps {
  doc: TermsDocument;
  onReachedEnd: () => void;
  /** Present when another document follows; shown on the last slide. */
  onNextDocument?: () => void;
}

const DocumentSlides: React.FC<DocumentSlidesProps> = ({ doc, onReachedEnd, onNextDocument }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const [index, setIndex] = useState(0);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const total = doc.sections.length;
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

    if (index === total - 1) onReachedEnd();
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
  };

  return (
    <div>
      <h2 className="text-[17px] font-semibold text-center leading-snug">{doc.title}</h2>
      {doc.subtitle && <p className="mt-0.5 text-center text-[14px] text-[#6e6e73]">{doc.subtitle}</p>}

      <div
        ref={trackRef}
        onScroll={handleScroll}
        role="region"
        aria-roledescription="carousel"
        aria-label={doc.title}
        style={{ height }}
        className="mt-4 no-scrollbar flex items-start snap-x snap-mandatory overflow-x-auto overflow-y-hidden transition-[height] duration-300"
      >
        {doc.sections.map((section, s) => (
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
              <h3 className="mt-1 mb-3 text-[18px] font-semibold">
                {s + 1}. {section.title}
              </h3>
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
          {doc.sections.map((section, i) => (
            <span
              key={section.title}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-[#1d1d1f]' : 'w-1.5 bg-[#d2d2d7]'
              }`}
            />
          ))}
        </div>

        {isLast && onNextDocument ? (
          <button
            type="button"
            onClick={onNextDocument}
            className="h-[40px] px-4 rounded-[980px] text-[15px] font-medium cursor-pointer"
          >
            Next document
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={isLast}
            className="h-[40px] px-4 rounded-[980px] text-[15px] font-medium disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            Next
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {doc.title}, section {index + 1} of {total}: {doc.sections[index]?.title}
      </p>
    </div>
  );
};

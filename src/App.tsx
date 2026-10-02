import React, { useEffect, useState } from 'react';
import { Header } from './components/Header.js';
import { Campaign } from './components/Campaign.js';
import { Terms } from './components/Terms.js';
import { FormScreen } from './components/FormScreen.js';
import { ThankYou } from './components/ThankYou.js';
import { Closed } from './components/Closed.js';

type Step = 'loading' | 'campaign' | 'terms' | 'form' | 'thanks' | 'closed';

/** Pages that show the ZUS COFFEE logo bar. The campaign page carries its own
 *  branding inside the campaign visual. Decided page by page. */
const SHOW_LOGO: Record<Step, boolean> = {
  loading: false,
  campaign: false,
  terms: true,
  form: true,
  thanks: true,
  closed: true,
};

interface Config {
  closed: boolean;
  turnstileSiteKey: string | null;
}

/**
 * Campaign → Terms → Form → Thank you. Steps live in memory and in history
 * state, so the phone's back button moves between them; a reload starts at the
 * campaign page.
 */
export default function App() {
  const [step, setStep] = useState<Step>('loading');
  const [config, setConfig] = useState<Config>({ closed: false, turnstileSiteKey: null });
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [termsRead, setTermsRead] = useState(false);

  const go = (next: Step) => {
    setStep(next);
    window.history.pushState({ step: next }, '');
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    fetch('/api/config')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((c: Config) => {
        setConfig(c);
        setStep(c.closed ? 'closed' : 'campaign');
      })
      .catch((err) => {
        // The form shows its own "security check unavailable" message.
        console.error('Failed to load config:', err);
        setStep('campaign');
      });

    window.history.replaceState({ step: 'campaign' }, '');
    const onPop = (e: PopStateEvent) => {
      const s = e.state?.step as Step | undefined;
      // Back from thank-you → a fresh, empty form; anything else steps back normally.
      setStep(s === 'terms' || s === 'form' ? s : 'campaign');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex flex-col items-center font-sans">
      {/* The campaign page is wider so its visual can reach 672px on desktop. */}
      <div
        className={`w-full flex flex-col flex-1 ${
          step === 'campaign' ? 'max-w-[704px]' : 'max-w-[480px] pb-12'
        }`}
      >
        {SHOW_LOGO[step] && <Header />}
        <main className="w-full flex-1 flex flex-col">
          {step === 'loading' && (
            <p className="py-24 text-center text-[14px] text-[#86868b] animate-pulse">Loading…</p>
          )}
          {step === 'campaign' && <Campaign onParticipate={() => go('terms')} />}
          {step === 'terms' && (
            <Terms
              alreadyRead={termsRead}
              onAgree={() => {
                setTermsRead(true);
                go('form');
              }}
            />
          )}
          {step === 'form' && (
            <FormScreen
              turnstileSiteKey={config.turnstileSiteKey}
              onSubmitted={(email) => {
                setSubmittedEmail(email);
                go('thanks');
              }}
              onClosed={() => go('closed')}
            />
          )}
          {step === 'thanks' && <ThankYou email={submittedEmail} />}
          {step === 'closed' && <Closed />}
        </main>
      </div>

      <footer className="w-full py-6 text-center border-t border-[#f5f5f7]">
        <p className="text-[12px] text-[#86868b]">
          &copy; {new Date().getFullYear()} ZUS Coffee Voucher Campaign
        </p>
      </footer>
    </div>
  );
}

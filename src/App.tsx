import React, { useEffect, useState } from 'react';
import { Header } from './components/Header.js';
import { IntroTerms } from './components/IntroTerms.js';
import { FormScreen } from './components/FormScreen.js';
import { ThankYou } from './components/ThankYou.js';
import { Closed } from './components/Closed.js';

type Step = 'loading' | 'intro' | 'form' | 'thanks' | 'closed';

interface Config {
  closed: boolean;
  turnstileSiteKey: string | null;
}

/**
 * Intro & Terms → Form → Thank you. Steps live in memory and in history state,
 * so the phone's back button moves between them; a reload starts at the intro.
 */
export default function App() {
  const [step, setStep] = useState<Step>('loading');
  const [config, setConfig] = useState<Config>({ closed: false, turnstileSiteKey: null });
  const [submittedEmail, setSubmittedEmail] = useState('');

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
        setStep(c.closed ? 'closed' : 'intro');
      })
      .catch((err) => {
        // The form shows its own "security check unavailable" message.
        console.error('Failed to load config:', err);
        setStep('intro');
      });

    window.history.replaceState({ step: 'intro' }, '');
    const onPop = (e: PopStateEvent) => {
      const s = e.state?.step as Step | undefined;
      // Back from the form → intro. Back from thank-you → a fresh, empty form.
      setStep(s === 'form' ? 'form' : 'intro');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex flex-col items-center font-sans">
      <div className="w-full max-w-[480px] flex flex-col flex-1 pb-12">
        <Header />
        <main className="w-full flex-1">
          {step === 'loading' && (
            <p className="py-24 text-center text-[14px] text-[#86868b] animate-pulse">Loading…</p>
          )}
          {step === 'intro' && <IntroTerms onAgree={() => go('form')} />}
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

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { GateScreen } from './components/GateScreen.js';
import { FormScreen } from './components/FormScreen.js';
import { SuccessScreen } from './components/SuccessScreen.js';

type AppRoute = '/' | '/form' | '/success';

interface RecipientInfo {
  fullName: string;
  email: string;
}

interface VoucherClaim {
  voucherCode: string;
  expiresAt: string;
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('/');
  const [campaignEndIso, setCampaignEndIso] = useState<string | null>(null);
  const [verifiedRecipient, setVerifiedRecipient] = useState<RecipientInfo | null>(null);
  const [claimedVoucher, setClaimedVoucher] = useState<VoucherClaim | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const navigate = (path: AppRoute) => {
    setCurrentRoute(path);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const config = await configRes.json();
          setCampaignEndIso(config.campaignEndIso || null);
        }

        const pathname = window.location.pathname;

        if (pathname === '/form') {
          const sessionRes = await fetch('/api/session');
          const sess = sessionRes.ok ? await sessionRes.json() : null;

          if (sess?.valid) {
            setVerifiedRecipient(sess.recipient || { fullName: '', email: '' });
            setCurrentRoute('/form');
          } else {
            navigate('/');
          }
        } else if (pathname === '/success') {
          /**
           * A voucher lives only in memory for the life of the tab. Landing on
           * /success directly — a reload, a bookmark, a shared link — means
           * there is no voucher to show, so the user goes back to the gate.
           *
           * Their code is already CLAIMED at this point, so re-entering it
           * returns 409 and they cannot see their voucher again. That is the
           * gap the post-claim transactional email closes (handoff §2, open
           * item 6). Until that email exists, a user who reloads this screen
           * has permanently lost their voucher.
           */
          navigate('/');
        } else {
          setCurrentRoute('/');
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setCurrentRoute('/');
      } finally {
        setIsInitializing(false);
      }
    };

    initApp();

    const handlePopState = () => {
      const path = window.location.pathname as AppRoute;
      setCurrentRoute(path === '/form' || path === '/success' ? path : '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleGateSuccess = (recipient: RecipientInfo) => {
    setVerifiedRecipient(recipient);
    navigate('/form');
  };

  const handleClaimSuccess = (voucherCode: string, expiresAt: string) => {
    setClaimedVoucher({ voucherCode, expiresAt });
    navigate('/success');
  };

  const handleResetToGate = async () => {
    await fetch('/api/session/clear', { method: 'POST' });
    setVerifiedRecipient(null);
    setClaimedVoucher(null);
    navigate('/');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="text-[14px] text-[#86868b] tracking-wide animate-pulse">Memuatkan...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex flex-col items-center justify-between font-sans selection:bg-[#f5f5f7]">
      <div className="w-full max-w-[480px] flex flex-col flex-1 pb-12">
        <Header />

        <main className="w-full flex-1 flex flex-col justify-center">
          {currentRoute === '/' && (
            <GateScreen campaignEndIso={campaignEndIso} onSuccess={handleGateSuccess} />
          )}

          {currentRoute === '/form' && (
            <FormScreen
              initialRecipient={verifiedRecipient || undefined}
              onSuccess={handleClaimSuccess}
              onSessionExpired={handleResetToGate}
            />
          )}

          {/*
            FIX H1 — this previously rendered
                voucherCode={claimedVoucher?.voucherCode || 'ZUS-PROMO-COFFEE'}
                expiresAt={claimedVoucher?.expiresAt || '2026-12-31'}
            so a user arriving here without a claim in memory was shown a
            fabricated code, styled exactly like a real one, which ZUS would
            reject at the counter. There is no fallback now: no claim, no
            screen.
          */}
          {currentRoute === '/success' && claimedVoucher && (
            <SuccessScreen
              voucherCode={claimedVoucher.voucherCode}
              expiresAt={claimedVoucher.expiresAt}
              onRedeemAnother={handleResetToGate}
            />
          )}
        </main>
      </div>

      <footer className="w-full py-6 text-center border-t border-[#f5f5f7]">
        <p className="text-[12px] text-[#86868b]">
          &copy; {new Date().getFullYear()} Kempen Penebusan ZUS Coffee. Hak cipta terpelihara.
        </p>
      </footer>
    </div>
  );
}

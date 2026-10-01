import React, { useState } from 'react';
import { CountdownTimer } from './CountdownTimer.js';

/**
 * FIX H5 — this component used to hold a hardcoded list of the Phase 1 access
 * codes and render them as clickable buttons whenever DATA_SOURCE was `mock`.
 *
 * Two invariants were broken:
 *   §4 — "No component holds a code list."
 *   §9 — "Never render the access code list ... to the client under any
 *         condition." Gating the panel only hid it; the codes were compiled
 *         into the browser bundle in both phases and readable in devtools.
 *
 * It also meant the UI differed between Phase 1 and Phase 2, which §4 forbids.
 *
 * The codes are now printed to the server console at boot in mock mode. This
 * screen is identical under both DATA_SOURCE values.
 */

interface GateScreenProps {
  campaignEndIso?: string | null;
  onSuccess: (recipient: { fullName: string; email: string }) => void;
}

export const GateScreen: React.FC<GateScreenProps> = ({ campaignEndIso, onSuccess }) => {
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCampaignExpired, setIsCampaignExpired] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading || isCampaignExpired) return;

    const trimmed = accessCode.trim().toUpperCase();
    if (!trimmed) {
      setErrorMessage('Sila masukkan kod akses');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: trimmed }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 410) {
          setIsCampaignExpired(true);
          setErrorMessage('Kempen telah tamat.');
        } else if (response.status === 409) {
          setErrorMessage('Kod ini telah pun digunakan.');
        } else if (response.status === 404) {
          setErrorMessage('Kod tidak sah. Sila semak semula e-mel anda.');
        } else if (response.status === 429) {
          setErrorMessage(
            data.error || 'Terlalu banyak percubaan. Sila tunggu 10 minit sebelum mencuba lagi.'
          );
        } else {
          setErrorMessage(data.error || 'Ralat pelayan. Sila cuba lagi sebentar lagi.');
        }
        return;
      }

      onSuccess(data.recipient || { fullName: '', email: '' });
    } catch {
      setErrorMessage('Ralat sambungan. Sila semak talian internet anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="gate-container" className="w-full max-w-[480px] mx-auto px-4 py-6">
      {campaignEndIso && (
        <CountdownTimer
          deadlineIso={campaignEndIso}
          onExpired={() => {
            setIsCampaignExpired(true);
            setErrorMessage('Kempen telah tamat.');
          }}
        />
      )}

      <div className="text-center mb-8">
        <h1
          id="gate-heading"
          className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-2 leading-tight"
        >
          Tebus Baucar Anda
        </h1>
        <p
          id="gate-subtext"
          className="text-[15px] sm:text-[16px] text-[#86868b] leading-relaxed max-w-[360px] mx-auto"
        >
          Sila masukkan kod akses yang diberikan dalam e-mel anda.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="access-code-input" className="sr-only">
            Masukkan kod akses
          </label>
          <input
            id="access-code-input"
            type="text"
            value={accessCode}
            onChange={(e) => {
              setAccessCode(e.target.value.toUpperCase());
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Masukkan kod akses"
            disabled={isLoading || isCampaignExpired}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            maxLength={20}
            className="w-full h-[52px] px-4 text-[17px] text-center font-mono tracking-wider font-semibold text-[#1d1d1f] placeholder:text-[#86868b] placeholder:font-sans placeholder:font-normal placeholder:tracking-normal bg-[#f5f5f7] border border-[#e5e5e7] rounded-[12px] focus:outline-none focus:bg-[#ffffff] focus:border-[#1d1d1f] transition-all disabled:opacity-50"
          />
        </div>

        {errorMessage && (
          <div
            id="gate-error-message"
            role="alert"
            className="p-3 bg-[#fff2f2] border border-[#ffcccc] rounded-[12px] text-center text-[14px] text-[#d70015] font-medium leading-snug"
          >
            {errorMessage}
          </div>
        )}

        <button
          id="gate-submit-btn"
          type="submit"
          disabled={isLoading || isCampaignExpired || !accessCode.trim()}
          className="w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] active:bg-[#000000] text-white text-[16px] font-medium rounded-[980px] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shadow-none"
        >
          {isLoading ? 'Menyemak kod...' : 'Semak Kod'}
        </button>
      </form>
    </div>
  );
};

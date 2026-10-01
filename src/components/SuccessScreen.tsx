import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SuccessScreenProps {
  voucherCode: string;
  expiresAt: string;
  onRedeemAnother?: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  voucherCode,
  expiresAt,
  onRedeemAnother,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(voucherCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = voucherCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Format expiry date in BM
  const formatMalayDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const monthsBM = [
        'Januari',
        'Februari',
        'Mac',
        'April',
        'Mei',
        'Jun',
        'Julai',
        'Ogos',
        'September',
        'Oktober',
        'November',
        'Disember',
      ];
      return `${d.getDate()} ${monthsBM[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="success-container" className="w-full max-w-[480px] mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1
          id="success-heading"
          className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-2 leading-tight"
        >
          Tahniah!
        </h1>
        <p
          id="success-subtext"
          className="text-[15px] sm:text-[16px] text-[#86868b] leading-relaxed max-w-[360px] mx-auto"
        >
          Berikut adalah kod baucar ZUS Coffee anda.
        </p>
      </div>

      {/* Voucher Code Card */}
      <div
        id="voucher-code-card"
        className="bg-[#f5f5f7] border border-[#e5e5e7] rounded-[16px] p-6 text-center mb-6"
      >
        <div className="text-[12px] font-medium tracking-wide text-[#86868b] uppercase mb-2">
          Kod Baucar ZUS Coffee
        </div>
        <div
          id="voucher-code-display"
          className="text-[26px] sm:text-[30px] font-bold font-mono tracking-widest text-[#1d1d1f] py-2 select-all"
        >
          {voucherCode}
        </div>
        <div id="voucher-expiry-line" className="text-[13px] text-[#86868b] mt-1">
          Sah sehingga {formatMalayDate(expiresAt)}
        </div>
      </div>

      {/* Copy Button */}
      <div className="space-y-4">
        <button
          id="copy-voucher-btn"
          type="button"
          onClick={handleCopy}
          className="w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] active:bg-[#000000] text-white text-[16px] font-medium rounded-[980px] transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Kod Disalin</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Salin Kod</span>
            </>
          )}
        </button>

        {onRedeemAnother && (
          <button
            type="button"
            onClick={onRedeemAnother}
            className="w-full h-[46px] bg-transparent text-[#86868b] hover:text-[#1d1d1f] text-[14px] font-medium transition cursor-pointer"
          >
            Kembali ke Halaman Utama
          </button>
        )}
      </div>

      {/*
        REMOVED — fabricated redemption instructions.

        This card previously walked the user through four steps for redeeming
        the code in the ZUS Coffee app ("open the app, choose a drink, enter the
        code at checkout, the discount applies automatically"). Nothing in
        either spec describes ZUS's redemption process; those steps were
        invented and presented to the user as fact. If they are wrong, every
        recipient is misdirected at the counter and the support load lands on
        marketing.

        Restore this block once ZUS confirms the actual redemption path, using
        their wording. It belongs in §11 of the handoff alongside the rest of
        the BM copy, and should be resolved with open items 4 and 5.
      */}
    </div>
  );
};

import React, { useState } from 'react';

interface FormScreenProps {
  initialRecipient?: { fullName: string; email: string };
  onSuccess: (voucherCode: string, expiresAt: string) => void;
  onSessionExpired: () => void;
}

export const FormScreen: React.FC<FormScreenProps> = ({
  initialRecipient,
  onSuccess,
  onSessionExpired,
}) => {
  const [fullName, setFullName] = useState(initialRecipient?.fullName || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(initialRecipient?.email || '');
  const [stateOrOutlet, setStateOrOutlet] = useState('Kuala Lumpur');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPoolExhausted, setIsPoolExhausted] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Client-side quick check (server Zod does the authoritative validation)
    const errors: Record<string, string[]> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = ['Sila masukkan nama penuh yang sah (minimum 2 huruf).'];
    }
    if (!phone.trim() || phone.trim().length < 8) {
      errors.phone = ['Sila masukkan nombor telefon yang sah (contoh: 0123456789).'];
    }
    if (!email.trim() || !email.includes('@')) {
      errors.email = ['Sila masukkan alamat e-mel yang sah.'];
    }
    if (!agreeTerms) {
      errors.agreeTerms = ['Sila tandakan persetujuan Terma & Syarat untuk meneruskan.'];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setGeneralError('Sila semak maklumat yang dimasukkan.');
      return;
    }

    setIsLoading(true);
    setGeneralError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          stateOrOutlet,
          agreeTerms: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // FIX C2 — 403 NOT_VERIFIED: the session names a recipient who never
        // passed the gate (forged cookie, or a stale one after a data reset).
        // Treated the same as an expired session: back to the gate.
        if (response.status === 401 || response.status === 403) {
          setIsSessionExpired(true);
          setGeneralError('Sesi pengesahan telah tamat. Sila sahkan kod anda semula.');
          return;
        }

        if (response.status === 503 || data.code === 'POOL_EXHAUSTED') {
          setIsPoolExhausted(true);
          setGeneralError('Semua baucar telah habis ditebus. Harap maaf atas sebarang kesulitan.');
          return;
        }

        if (response.status === 400 && data.details) {
          setFieldErrors(data.details);
          setGeneralError(data.error || 'Maklumat borang tidak sah.');
          return;
        }

        setGeneralError(data.error || 'Ralat semasa memproses tebusan. Sila cuba lagi.');
        return;
      }

      // Success: voucher claimed
      onSuccess(data.voucherCode, data.expiresAt);
    } catch {
      setGeneralError('Ralat sambungan. Sila semak talian internet anda.');
    } finally {
      setIsLoading(false);
    }
  };

  // State: Verification session expired screen
  if (isSessionExpired) {
    return (
      <div id="session-expired-state" className="w-full max-w-[480px] mx-auto px-4 py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 bg-[#fff2f2] border border-[#ffcccc] rounded-full flex items-center justify-center text-[#d70015]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-[24px] font-bold text-[#1d1d1f] tracking-tight mb-2">
          Sesi Pengesahan Telah Tamat
        </h2>
        <p className="text-[15px] text-[#86868b] leading-relaxed mb-6">
          Atas sebab keselamatan, sesi pengesahan kod anda telah luput. Sila masukkan semula kod akses anda di pintu masuk kempen.
        </p>
        <button
          type="button"
          onClick={onSessionExpired}
          className="w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] text-white text-[16px] font-medium rounded-[980px] transition cursor-pointer"
        >
          Kembali ke Pintu Masuk
        </button>
      </div>
    );
  }

  // State: Pool exhausted screen
  if (isPoolExhausted) {
    return (
      <div id="pool-exhausted-state" className="w-full max-w-[480px] mx-auto px-4 py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 bg-[#f5f5f7] border border-[#e5e5e7] rounded-full flex items-center justify-center text-[#1d1d1f]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4M12 4v16" />
          </svg>
        </div>
        <h2 className="text-[24px] font-bold text-[#1d1d1f] tracking-tight mb-2">
          Baucar Telah Habis Ditebus
        </h2>
        <p className="text-[15px] text-[#86868b] leading-relaxed mb-6">
          Semua kuota baucar ZUS Coffee bagi kempen ini telah habis ditebus oleh para peserta. Terima kasih atas sokongan anda.
        </p>
        <button
          type="button"
          onClick={onSessionExpired}
          className="w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] text-white text-[16px] font-medium rounded-[980px] transition cursor-pointer"
        >
          Kembali ke Halaman Utama
        </button>
      </div>
    );
  }

  return (
    <div id="form-container" className="w-full max-w-[480px] mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1
          id="form-heading"
          className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] tracking-tight mb-2 leading-tight"
        >
          Maklumat Anda
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[#86868b] leading-relaxed max-w-[380px] mx-auto">
          Lengkapkan maklumat anda untuk menebus kod baucar ZUS Coffee anda.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="full-name-input" className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
            Nama Penuh
          </label>
          <input
            id="full-name-input"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) {
                const next = { ...fieldErrors };
                delete next.fullName;
                setFieldErrors(next);
              }
            }}
            placeholder="Ahmad Farhan"
            className="w-full h-[48px] px-3.5 text-[15px] text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5e7] rounded-[12px] focus:outline-none focus:bg-[#ffffff] focus:border-[#1d1d1f] transition"
          />
          {fieldErrors.fullName && (
            <p className="mt-1 text-[12px] text-[#d70015] font-medium">{fieldErrors.fullName[0]}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone-input" className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
            Nombor Telefon
          </label>
          <input
            id="phone-input"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (fieldErrors.phone) {
                const next = { ...fieldErrors };
                delete next.phone;
                setFieldErrors(next);
              }
            }}
            placeholder="0123456789"
            className="w-full h-[48px] px-3.5 text-[15px] text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5e7] rounded-[12px] focus:outline-none focus:bg-[#ffffff] focus:border-[#1d1d1f] transition"
          />
          {fieldErrors.phone && (
            <p className="mt-1 text-[12px] text-[#d70015] font-medium">{fieldErrors.phone[0]}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email-input" className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
            Alamat E-mel
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                const next = { ...fieldErrors };
                delete next.email;
                setFieldErrors(next);
              }
            }}
            placeholder="nama@email.com"
            className="w-full h-[48px] px-3.5 text-[15px] text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5e7] rounded-[12px] focus:outline-none focus:bg-[#ffffff] focus:border-[#1d1d1f] transition"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-[12px] text-[#d70015] font-medium">{fieldErrors.email[0]}</p>
          )}
        </div>

        {/* State / Outlet Preference */}
        <div>
          <label htmlFor="state-select" className="block text-[13px] font-medium text-[#1d1d1f] mb-1.5">
            Negeri / Cawangan Pilihan
          </label>
          <select
            id="state-select"
            value={stateOrOutlet}
            onChange={(e) => setStateOrOutlet(e.target.value)}
            className="w-full h-[48px] px-3 text-[15px] text-[#1d1d1f] bg-[#f5f5f7] border border-[#e5e5e7] rounded-[12px] focus:outline-none focus:bg-[#ffffff] focus:border-[#1d1d1f] transition cursor-pointer"
          >
            <option value="Kuala Lumpur">Kuala Lumpur</option>
            <option value="Selangor">Selangor</option>
            <option value="Pulau Pinang">Pulau Pinang</option>
            <option value="Johor">Johor</option>
            <option value="Perak">Perak</option>
            <option value="Melaka">Melaka</option>
            <option value="Negeri Sembilan">Negeri Sembilan</option>
            <option value="Kedah">Kedah</option>
            <option value="Pahang">Pahang</option>
            <option value="Kelantan">Kelantan</option>
            <option value="Terengganu">Terengganu</option>
            <option value="Sabah">Sabah</option>
            <option value="Sarawak">Sarawak</option>
            <option value="Perlis">Perlis</option>
            <option value="Putrajaya">Putrajaya</option>
          </select>
        </div>

        {/* Terms & Conditions Agreement */}
        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              id="agree-terms-checkbox"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                if (fieldErrors.agreeTerms) {
                  const next = { ...fieldErrors };
                  delete next.agreeTerms;
                  setFieldErrors(next);
                }
              }}
              className="mt-1 h-4 w-4 rounded border-[#e5e5e7] text-[#1d1d1f] focus:ring-0 cursor-pointer"
            />
            <span className="text-[13px] text-[#86868b] leading-tight">
              Saya bersetuju dengan Terma & Syarat kempen serta pemberian baucar ZUS Coffee ini.
            </span>
          </label>
          {fieldErrors.agreeTerms && (
            <p className="mt-1 text-[12px] text-[#d70015] font-medium">{fieldErrors.agreeTerms[0]}</p>
          )}
        </div>

        {generalError && (
          <div
            id="form-error-message"
            role="alert"
            className="p-3 bg-[#fff2f2] border border-[#ffcccc] rounded-[12px] text-center text-[14px] text-[#d70015] font-medium"
          >
            {generalError}
          </div>
        )}

        <button
          id="form-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] active:bg-[#000000] text-white text-[16px] font-medium rounded-[980px] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer pt-0"
        >
          {isLoading ? 'Memproses...' : 'Hantar & Tebus'}
        </button>
      </form>
    </div>
  );
};

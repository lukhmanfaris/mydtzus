import React, { useState } from 'react';
import {
  SubmissionSchema,
  toFieldErrors,
  type FieldErrors,
  type SubmissionInput,
} from '../../lib/validation/form.js';
import { useTurnstile } from '../useTurnstile.js';
import { PDPA_NOTICE_URL, PRIVACY_POLICY_URL } from '../content/campaign.js';

interface FormScreenProps {
  turnstileSiteKey: string | null;
  onSubmitted: (email: string) => void;
  onClosed: () => void;
}

type TextField = 'referralCode' | 'fullName' | 'phone' | 'email' | 'companyName';

const FIELDS: Array<{
  name: TextField;
  label: string;
  type: string;
  placeholder: string;
  autoComplete: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}> = [
  { name: 'referralCode', label: 'Referral Code', type: 'text', placeholder: 'As stated in your email', autoComplete: 'off' },
  { name: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Ahmad Farhan', autoComplete: 'name' },
  { name: 'phone', label: 'Phone No.', type: 'tel', placeholder: '012-345 6789', autoComplete: 'tel', inputMode: 'tel' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'name@company.com', autoComplete: 'email', inputMode: 'email' },
  { name: 'companyName', label: 'Company Name', type: 'text', placeholder: 'Company Sdn Bhd', autoComplete: 'organization' },
];

const EMPTY: Record<TextField, string> = {
  referralCode: '',
  fullName: '',
  phone: '',
  email: '',
  companyName: '',
};

/** Page 2 — the campaign form. */
export const FormScreen: React.FC<FormScreenProps> = ({ turnstileSiteKey, onSubmitted, onClosed }) => {
  const [values, setValues] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const turnstile = useTurnstile(turnstileSiteKey);

  const clearError = (name: keyof FieldErrors) => {
    if (!fieldErrors[name]) return;
    const next = { ...fieldErrors };
    delete next[name];
    setFieldErrors(next);
    if (Object.keys(next).length === 0) setGeneralError(null);
  };

  const focusFirstError = (errors: FieldErrors) => {
    const first = [...FIELDS.map((f) => f.name), 'consent', 'termsAccepted'].find(
      (n) => errors[n as keyof FieldErrors]
    );
    if (first) document.getElementById(`field-${first}`)?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const input: SubmissionInput = {
      ...values,
      consent: consent as true,
      termsAccepted: termsAccepted as true,
    };
    const parsed = SubmissionSchema.safeParse(input);
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setGeneralError('Please check the highlighted fields.');
      focusFirstError(errors);
      return;
    }

    if (!turnstile.token) {
      setGeneralError('Please wait a moment while we verify your browser, then try again.');
      return;
    }

    setIsLoading(true);
    setGeneralError(null);
    setFieldErrors({});

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, turnstileToken: turnstile.token }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        onSubmitted(parsed.data.email);
        return;
      }

      turnstile.reset();

      if (res.status === 410) {
        onClosed();
        return;
      }
      if (res.status === 400 && data.fields) {
        setFieldErrors(data.fields);
        focusFirstError(data.fields);
      }
      setGeneralError(data.error || 'Something went wrong. Please try again.');
    } catch {
      turnstile.reset();
      setGeneralError('Connection problem. Please check your internet and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifying = !!turnstileSiteKey && !turnstile.token && !turnstile.failed;
  const unavailable = !turnstileSiteKey || turnstile.failed;

  return (
    <div className="w-full px-4 py-2">
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-bold tracking-tight mb-2 leading-tight">Your Details</h1>
        <p className="text-[15px] text-[#86868b] leading-relaxed max-w-[380px] mx-auto">
          Fill in your details below. Your ZUS Coffee voucher will be sent to the email you provide.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {FIELDS.map((field) => {
          const error = fieldErrors[field.name];
          return (
            <div key={field.name}>
              <label htmlFor={`field-${field.name}`} className="block text-[13px] font-medium mb-1.5">
                {field.label}
              </label>
              <input
                id={`field-${field.name}`}
                name={field.name}
                type={field.type}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete}
                autoCapitalize={field.name === 'referralCode' ? 'characters' : undefined}
                value={values[field.name]}
                onChange={(e) => {
                  setValues({ ...values, [field.name]: e.target.value });
                  clearError(field.name);
                }}
                placeholder={field.placeholder}
                aria-invalid={!!error}
                aria-describedby={error ? `error-${field.name}` : undefined}
                className={`w-full h-[48px] px-3.5 text-[16px] bg-[#f5f5f7] border rounded-[12px] focus:outline-none focus:bg-white focus:border-[#1d1d1f] transition ${
                  error ? 'border-[#d70015]' : 'border-[#e5e5e7]'
                }`}
              />
              {error && (
                <p id={`error-${field.name}`} className="mt-1 text-[12px] text-[#d70015] font-medium">
                  {error}
                </p>
              )}
            </div>
          );
        })}

        <div className="pt-2 space-y-4">
          <TickBox
            name="consent"
            checked={consent}
            error={fieldErrors.consent}
            onChange={(v) => {
              setConsent(v);
              clearError('consent');
            }}
          >
            I consent to MYDATA Analytics Sdn Bhd collecting and using my personal data to administer
            this Programme and deliver my voucher, in accordance with MYDATA&rsquo;s{' '}
            <ExternalLink href={PRIVACY_POLICY_URL}>Privacy Policy</ExternalLink> and{' '}
            <ExternalLink href={PDPA_NOTICE_URL}>PDPA Notice</ExternalLink>.
          </TickBox>

          <TickBox
            name="termsAccepted"
            checked={termsAccepted}
            error={fieldErrors.termsAccepted}
            onChange={(v) => {
              setTermsAccepted(v);
              clearError('termsAccepted');
            }}
          >
            I accept the Terms and Conditions.
          </TickBox>
        </div>

        {/* Turnstile renders here; invisible unless a challenge is needed. */}
        <div ref={turnstile.containerRef} className="flex justify-center empty:hidden" />

        {unavailable && (
          <p role="alert" className="text-center text-[13px] text-[#d70015]">
            We couldn't load the security check. Please refresh the page, or turn off any content
            blocker and try again.
          </p>
        )}

        {generalError && (
          <div
            role="alert"
            className="p-3 bg-[#fff2f2] border border-[#ffcccc] rounded-[12px] text-center text-[14px] text-[#d70015] font-medium"
          >
            {generalError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || verifying || unavailable}
          className="w-full h-[50px] bg-[#1d1d1f] hover:bg-[#333336] active:bg-black text-white text-[16px] font-medium rounded-[980px] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? 'Submitting…' : verifying ? 'Verifying your browser…' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  // New tab, so a half-filled form is not lost.
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
    {children}
  </a>
);

interface TickBoxProps {
  name: 'consent' | 'termsAccepted';
  checked: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}

const TickBox: React.FC<TickBoxProps> = ({ name, checked, error, onChange, children }) => (
  <div>
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        id={`field-${name}`}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={!!error}
        aria-describedby={error ? `error-${name}` : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#1d1d1f] cursor-pointer"
      />
      <span className="text-[14px] leading-relaxed">{children}</span>
    </label>
    {error && (
      <p id={`error-${name}`} className="mt-1 ml-8 text-[12px] text-[#d70015] font-medium">
        {error}
      </p>
    )}
  </div>
);

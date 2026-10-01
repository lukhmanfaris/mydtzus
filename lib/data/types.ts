export type RecipientStatus = 'LOCKED' | 'VERIFIED' | 'CLAIMED';
export type VoucherStatus = 'AVAILABLE' | 'ISSUED';

export interface Recipient {
  id: string;
  full_name: string;
  email: string;
  access_code: string;
  status: RecipientStatus;
  assigned_to?: string | null;
  verified_at?: string | null;
  claimed_at?: string | null;
  voucher_id?: string | null;
  created_at?: string;
}

export interface Voucher {
  id: string;
  code: string;
  status: VoucherStatus;
  issued_to?: string | null;
  issued_at?: string | null;
  expires_at: string;
}

export interface FormPayload {
  fullName: string;
  phone: string;
  email: string;
  stateOrOutlet?: string;
  agreeTerms: boolean;
}

export interface ClaimResult {
  voucherCode: string;
  expiresAt: string;
}

export interface FormResponse {
  id: string;
  recipient_id: string;
  payload: Record<string, unknown>;
  submitted_at: string;
}

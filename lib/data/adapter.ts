import { createMockAdapter } from './mock.js';
import { createSupabaseAdapter } from './supabase.js';

/**
 * The adapter boundary. The Worker imports this and nothing below it — no
 * Supabase client, no mock store.
 */

/** One row of `submissions`, as written by the app. Voucher columns are filled
 *  in later by `assign_pending_vouchers()`. */
export interface SubmissionRecord {
  referral_code: string;
  full_name: string;
  phone: string;
  email: string;
  company_name: string;
  terms_accepted_at: string;
}

/** What happened to an entry. Only ENTERED means the person has a place. */
export type EntryResult = 'ENTERED' | 'INVALID_CODE' | 'FULL';

export interface DataAdapter {
  /**
   * Checks the referral code and its group's limit and stores the entry, in one
   * step so two people cannot both take a group's last place.
   */
  enterCampaign(record: SubmissionRecord): Promise<EntryResult>;
  /** True if a submission with this email AND phone arrived at or after `sinceIso`. */
  hasRecentSubmission(email: string, phone: string, sinceIso: string): Promise<boolean>;
  /** Cheap read that counts as database activity (keeps a free Supabase project awake). */
  ping(): Promise<void>;
  /** True when every active group has no places left. False if there are no groups. */
  allGroupsFull(): Promise<boolean>;
}

/** The subset of the Worker environment the data layer reads. */
export interface DataEnv {
  DATA_SOURCE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Local testing only: the mock's voucher limit. Blank or 0 means no limit. */
  MOCK_VOUCHER_CODES?: string;
}

export function getDataAdapter(env: DataEnv): DataAdapter {
  const source = (env.DATA_SOURCE || 'supabase').toLowerCase().trim();
  if (source === 'mock') return createMockAdapter(Number(env.MOCK_VOUCHER_CODES) || 0);
  return createSupabaseAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

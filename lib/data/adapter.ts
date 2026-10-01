import { mockAdapter } from './mock.js';
import { createSupabaseAdapter } from './supabase.js';

/**
 * The adapter boundary. The Worker imports this and nothing below it — no
 * Supabase client, no mock store.
 */

/** One row of `submissions`, as written by the app. Voucher columns are left
 *  for the team (or the optional auto-assign script) to fill in later. */
export interface SubmissionRecord {
  referral_code: string;
  full_name: string;
  phone: string;
  email: string;
  company_name: string;
  terms_accepted_at: string;
  consent_at: string;
}

export interface DataAdapter {
  insertSubmission(record: SubmissionRecord): Promise<{ id: string }>;
}

/** The subset of the Worker environment the data layer reads. */
export interface DataEnv {
  DATA_SOURCE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function getDataAdapter(env: DataEnv): DataAdapter {
  const source = (env.DATA_SOURCE || 'supabase').toLowerCase().trim();
  if (source === 'mock') return mockAdapter;
  return createSupabaseAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

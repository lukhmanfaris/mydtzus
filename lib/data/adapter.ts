import type { Recipient, ClaimResult } from './types.js';
import { mockAdapter } from './mock.js';
import { supabaseAdapter } from './supabase.js';

/**
 * The adapter boundary. Route handlers and components import this interface and
 * nothing below it — no Supabase client, no mock store, no code list.
 *
 * FIX H6 — `getRecipientById` added.
 * server.ts previously imported `mockStore` directly to serve /api/session,
 * reaching around this boundary. Under DATA_SOURCE=supabase that route returned
 * a fabricated recipient. It now goes through the adapter like everything else.
 */
export interface DataAdapter {
  getRecipientByCode(code: string): Promise<Recipient | null>;
  getRecipientById(recipientId: string): Promise<Recipient | null>;
  markVerified(recipientId: string): Promise<Recipient>;
  claimVoucher(recipientId: string, formPayload: object): Promise<ClaimResult>;
}

/**
 * Errors the adapters raise. Route handlers map these to HTTP status codes, so
 * both implementations must use exactly these strings.
 */
export const AdapterError = {
  /** No AVAILABLE voucher remains in the pool. → 503, dedicated screen. */
  POOL_EXHAUSTED: 'VOUCHER_POOL_EXHAUSTED',
  /** Recipient id in the session does not exist. → 401. */
  RECIPIENT_NOT_FOUND: 'RECIPIENT_NOT_FOUND',
  /** Recipient exists but never passed the gate. → 403. See FIX C2. */
  NOT_VERIFIED: 'RECIPIENT_NOT_VERIFIED',
} as const;

export function getDataAdapter(): DataAdapter {
  const dataSource = (process.env.DATA_SOURCE || 'mock').toLowerCase().trim();
  if (dataSource === 'supabase') {
    return supabaseAdapter;
  }
  return mockAdapter;
}

export const dataAdapter: DataAdapter = {
  getRecipientByCode: (code) => getDataAdapter().getRecipientByCode(code),
  getRecipientById: (recipientId) => getDataAdapter().getRecipientById(recipientId),
  markVerified: (recipientId) => getDataAdapter().markVerified(recipientId),
  claimVoucher: (recipientId, formPayload) =>
    getDataAdapter().claimVoucher(recipientId, formPayload),
};

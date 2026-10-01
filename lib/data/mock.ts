import type { DataAdapter } from './adapter.js';
import { AdapterError } from './adapter.js';
import type { Recipient, Voucher, FormResponse, ClaimResult } from './types.js';
import { normaliseAccessCode } from '../validation/normalise.js';

/**
 * Phase 1 seed data. In-memory only — never reachable under
 * DATA_SOURCE=supabase, and never shipped to the browser.
 *
 * OPEN ITEM 4 / 5 — the voucher codes and the 2026-12-31 expiry below are
 * INVENTED placeholders for testing the flow. They are not real ZUS vouchers.
 * Both must be replaced with the real batch before the announcement email goes
 * out; a valid access code redeeming into a fake voucher is the worst failure
 * mode this campaign has.
 */
const INITIAL_RECIPIENTS: Recipient[] = [
  {
    id: 'rec-test-aa',
    full_name: 'Ahmad Farhan',
    email: 'farhan@example.com.my',
    access_code: 'TESTAA',
    status: 'LOCKED',
    assigned_to: 'Campaign Batch A',
    verified_at: null,
    claimed_at: null,
    voucher_id: null,
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'rec-test-bb',
    full_name: 'Nurul Izzah',
    email: 'nurul@example.com.my',
    access_code: 'TESTBB',
    status: 'VERIFIED',
    assigned_to: 'Campaign Batch A',
    verified_at: '2026-09-17T20:00:00.000Z',
    claimed_at: null,
    voucher_id: null,
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'rec-test-cc',
    full_name: 'Lee Wei Jun',
    email: 'weijun@example.com.my',
    access_code: 'TESTCC',
    status: 'CLAIMED',
    assigned_to: 'Campaign Batch A',
    verified_at: '2026-09-16T12:00:00.000Z',
    claimed_at: '2026-09-16T12:05:00.000Z',
    voucher_id: 'v-claimed-001',
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'rec-test-dd',
    full_name: 'Siti Sarah',
    email: 'siti@example.com.my',
    access_code: 'TESTDD',
    status: 'LOCKED',
    assigned_to: 'Campaign Batch B',
    verified_at: null,
    claimed_at: null,
    voucher_id: null,
    created_at: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'rec-test-ee',
    full_name: 'Tan Mei Ling',
    email: 'meiling@example.com.my',
    access_code: 'TESTEE',
    status: 'LOCKED',
    assigned_to: 'Campaign Batch B',
    verified_at: null,
    claimed_at: null,
    voucher_id: null,
    created_at: '2026-09-01T08:00:00.000Z',
  },
];

/** 3 AVAILABLE vouchers only, so pool exhaustion is reachable in testing (spec §13). */
const INITIAL_VOUCHERS: Voucher[] = [
  {
    id: 'v-claimed-001',
    code: 'PLACEHOLDER-CLAIMED-CC99',
    status: 'ISSUED',
    issued_to: 'rec-test-cc',
    issued_at: '2026-09-16T12:05:00.000Z',
    expires_at: '2026-12-31',
  },
  {
    id: 'v-pool-001',
    code: 'PLACEHOLDER-POOL-001',
    status: 'AVAILABLE',
    issued_to: null,
    issued_at: null,
    expires_at: '2026-12-31',
  },
  {
    id: 'v-pool-002',
    code: 'PLACEHOLDER-POOL-002',
    status: 'AVAILABLE',
    issued_to: null,
    issued_at: null,
    expires_at: '2026-12-31',
  },
  {
    id: 'v-pool-003',
    code: 'PLACEHOLDER-POOL-003',
    status: 'AVAILABLE',
    issued_to: null,
    issued_at: null,
    expires_at: '2026-12-31',
  },
];

class MockStore {
  private recipients: Map<string, Recipient> = new Map();
  private vouchers: Map<string, Voucher> = new Map();
  private formResponses: FormResponse[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.recipients.clear();
    this.vouchers.clear();
    this.formResponses = [];

    for (const r of INITIAL_RECIPIENTS) this.recipients.set(r.id, { ...r });
    for (const v of INITIAL_VOUCHERS) this.vouchers.set(v.id, { ...v });
  }

  async getRecipientByCode(code: string): Promise<Recipient | null> {
    const normalized = normaliseAccessCode(code);
    if (!normalized) return null;

    for (const r of this.recipients.values()) {
      if (r.access_code.toUpperCase() === normalized) {
        return { ...r };
      }
    }
    return null;
  }

  async getRecipientById(id: string): Promise<Recipient | null> {
    const r = this.recipients.get(id);
    return r ? { ...r } : null;
  }

  async markVerified(recipientId: string): Promise<Recipient> {
    const r = this.recipients.get(recipientId);
    if (!r) throw new Error(AdapterError.RECIPIENT_NOT_FOUND);

    if (r.status === 'LOCKED') {
      r.status = 'VERIFIED';
      r.verified_at = new Date().toISOString();
    } else if (r.status === 'VERIFIED' && !r.verified_at) {
      // Spec §5 — VERIFIED stays re-enterable. Status is left alone.
      r.verified_at = new Date().toISOString();
    }

    this.recipients.set(recipientId, r);
    return { ...r };
  }

  async claimVoucher(recipientId: string, formPayload: object): Promise<ClaimResult> {
    const recipient = this.recipients.get(recipientId);
    if (!recipient) throw new Error(AdapterError.RECIPIENT_NOT_FOUND);

    /**
     * FIX C2 — the claim step never checked that the recipient had actually
     * passed the gate. Combined with the forgeable session (C1), a crafted
     * cookie for a LOCKED recipient drew a real voucher without an access code
     * ever being entered. Confirmed by exploit.
     *
     * Defence in depth: even with a strong SESSION_SECRET, the claim step now
     * refuses to serve a recipient who is not VERIFIED or already CLAIMED.
     */
    if (recipient.status === 'LOCKED') {
      throw new Error(AdapterError.NOT_VERIFIED);
    }

    // Idempotent (spec §7): an already-CLAIMED recipient gets back the voucher
    // already linked to them, never a second draw.
    if (recipient.status === 'CLAIMED') {
      const existing = recipient.voucher_id
        ? this.vouchers.get(recipient.voucher_id)
        : undefined;

      if (existing) {
        return { voucherCode: existing.code, expiresAt: existing.expires_at };
      }

      /**
       * CLAIMED with no resolvable voucher is a data integrity fault. The
       * previous code fell through and drew a NEW voucher here, silently
       * issuing a second voucher to one recipient. Fail loudly instead.
       */
      throw new Error(
        `Data integrity fault: recipient ${recipientId} is CLAIMED but has no resolvable voucher.`
      );
    }

    // status is VERIFIED — draw from the pool.
    let chosen: Voucher | null = null;
    for (const v of this.vouchers.values()) {
      if (v.status === 'AVAILABLE') {
        chosen = v;
        break;
      }
    }

    if (!chosen) throw new Error(AdapterError.POOL_EXHAUSTED);

    const now = new Date().toISOString();

    this.formResponses.push({
      id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      recipient_id: recipientId,
      payload: formPayload as Record<string, unknown>,
      submitted_at: now,
    });

    chosen.status = 'ISSUED';
    chosen.issued_to = recipientId;
    chosen.issued_at = now;
    this.vouchers.set(chosen.id, chosen);

    recipient.status = 'CLAIMED';
    recipient.claimed_at = now;
    recipient.voucher_id = chosen.id;
    this.recipients.set(recipientId, recipient);

    return { voucherCode: chosen.code, expiresAt: chosen.expires_at };
  }

  /** Server-side only. Never exposed on a route — see spec §9. */
  getStats() {
    let availableVouchers = 0;
    for (const v of this.vouchers.values()) {
      if (v.status === 'AVAILABLE') availableVouchers += 1;
    }
    return { totalRecipients: this.recipients.size, availableVouchers };
  }
}

export const mockStore = new MockStore();

export const mockAdapter: DataAdapter = {
  getRecipientByCode: (code) => mockStore.getRecipientByCode(code),
  getRecipientById: (id) => mockStore.getRecipientById(id),
  markVerified: (recipientId) => mockStore.markVerified(recipientId),
  claimVoucher: (recipientId, formPayload) => mockStore.claimVoucher(recipientId, formPayload),
};

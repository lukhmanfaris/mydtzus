import type { DataAdapter, SubmissionRecord } from './adapter.js';

/**
 * Local development store. Lives in memory for the life of the Worker isolate,
 * so it resets on every restart — never point a real campaign at it. Each row
 * is logged so you can see exactly what would have been written to Supabase.
 */
const rows: Array<SubmissionRecord & { id: string; submitted_at: string }> = [];

/** The one referral code the mock accepts. A stand-in: real codes live in Supabase. */
const MOCK_REFERRAL_CODE = 'LOCALTEST';

// Same rule as the voucher_people view: one person per email and per phone.
function countPeople(): number {
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  let people = 0;
  for (const r of rows) {
    if (!seenEmail.has(r.email) && !seenPhone.has(r.phone)) people++;
    seenEmail.add(r.email);
    seenPhone.add(r.phone);
  }
  return people;
}

/** `totalCodes` of 0 means no limit, so the form stays open. */
export const createMockAdapter = (totalCodes: number): DataAdapter => {
  const isFull = () => totalCodes > 0 && countPeople() >= totalCodes;

  return {
    async enterCampaign(record) {
      if (record.referral_code !== MOCK_REFERRAL_CODE) return 'INVALID_CODE';

      if (isFull()) {
        const alreadyIn = rows.some((r) => r.email === record.email && r.phone === record.phone);
        return alreadyIn ? 'ENTERED' : 'FULL';
      }

      const row = { ...record, id: crypto.randomUUID(), submitted_at: new Date().toISOString() };
      rows.push(row);
      console.log(`[mock] submission #${rows.length}`, JSON.stringify(row));
      return 'ENTERED';
    },

    async hasRecentSubmission(email, phone, sinceIso) {
      return rows.some((r) => r.email === email && r.phone === phone && r.submitted_at >= sinceIso);
    },

    async ping() {
      console.log(`[mock] ping (${rows.length} rows)`);
    },

    async allGroupsFull() {
      return isFull();
    },
  };
};

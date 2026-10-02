import type { DataAdapter, SubmissionRecord } from './adapter.js';

/**
 * Local development store. Lives in memory for the life of the Worker isolate,
 * so it resets on every restart — never point a real campaign at it. Each row
 * is logged so you can see exactly what would have been written to Supabase.
 */
const rows: Array<SubmissionRecord & { id: string; submitted_at: string }> = [];

export const mockAdapter: DataAdapter = {
  async insertSubmission(record) {
    const row = { ...record, id: crypto.randomUUID(), submitted_at: new Date().toISOString() };
    rows.push(row);
    console.log(`[mock] submission #${rows.length}`, JSON.stringify(row));
    return { id: row.id };
  },

  async hasRecentSubmission(email, phone, sinceIso) {
    return rows.some((r) => r.email === email && r.phone === phone && r.submitted_at >= sinceIso);
  },

  async ping() {
    console.log(`[mock] ping (${rows.length} rows)`);
  },
};

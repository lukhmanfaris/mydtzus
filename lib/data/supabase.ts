import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataAdapter } from './adapter.js';
import { AdapterError } from './adapter.js';
import type { Recipient, ClaimResult } from './types.js';
import { normaliseAccessCode } from '../validation/normalise.js';

/**
 * Constructed lazily, on first use. Phase 1 (DATA_SOURCE=mock) therefore boots
 * with no Supabase credentials present, as spec §14 requires — verified by
 * running the app with both Supabase variables unset.
 */
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY, or run with DATA_SOURCE=mock.'
    );
  }

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
}

/** Map a Postgres error raised by the RPC onto the shared adapter error set. */
function mapRpcError(message: string | undefined): Error {
  const text = message ?? '';
  if (text.includes(AdapterError.POOL_EXHAUSTED)) return new Error(AdapterError.POOL_EXHAUSTED);
  if (text.includes(AdapterError.NOT_VERIFIED)) return new Error(AdapterError.NOT_VERIFIED);
  if (text.includes(AdapterError.RECIPIENT_NOT_FOUND)) {
    return new Error(AdapterError.RECIPIENT_NOT_FOUND);
  }
  return new Error(text || 'Unknown error from draw_voucher_atomic');
}

export const supabaseAdapter: DataAdapter = {
  async getRecipientByCode(code: string): Promise<Recipient | null> {
    const client = getSupabase();
    const normalized = normaliseAccessCode(code);
    if (!normalized) return null;

    /**
     * FIX C5 — this used `.ilike(...)` on raw user input.
     *
     * `ilike` is a pattern operator: `%` and `_` are wildcards, so an access
     * code of `%` matched the first recipient row and opened the gate for
     * somebody with no code at all.
     *
     * `.eq()` compares literally. The input is already uppercased by
     * normaliseAccessCode, so access codes MUST be stored uppercase — enforce
     * that on import, and see the CHECK constraint in the migration.
     */
    const { data, error } = await client
      .from('recipients')
      .select('*')
      .eq('access_code', normalized)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseAdapter] getRecipientByCode error:', error);
      throw error;
    }
    return (data as Recipient | null) ?? null;
  },

  /** FIX H6 — lets /api/session go through the adapter instead of the mock store. */
  async getRecipientById(recipientId: string): Promise<Recipient | null> {
    const client = getSupabase();

    const { data, error } = await client
      .from('recipients')
      .select('*')
      .eq('id', recipientId)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseAdapter] getRecipientById error:', error);
      throw error;
    }
    return (data as Recipient | null) ?? null;
  },

  async markVerified(recipientId: string): Promise<Recipient> {
    const client = getSupabase();

    const { data: current, error: checkError } = await client
      .from('recipients')
      .select('status, verified_at')
      .eq('id', recipientId)
      .maybeSingle();

    if (checkError) {
      console.error('[SupabaseAdapter] markVerified check error:', checkError);
      throw checkError;
    }
    if (!current) throw new Error(AdapterError.RECIPIENT_NOT_FOUND);

    const updates: Record<string, unknown> = {};
    if (current.status === 'LOCKED') {
      updates.status = 'VERIFIED';
      updates.verified_at = new Date().toISOString();
    } else if (current.status === 'VERIFIED' && !current.verified_at) {
      // Spec §5 — VERIFIED is re-enterable; status is never rewritten here.
      updates.verified_at = new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      const { data, error } = await client
        .from('recipients')
        .update(updates)
        .eq('id', recipientId)
        .select()
        .single();

      if (error) {
        console.error('[SupabaseAdapter] markVerified update error:', error);
        throw error;
      }
      return data as Recipient;
    }

    const { data: unchanged, error: fetchError } = await client
      .from('recipients')
      .select('*')
      .eq('id', recipientId)
      .single();

    if (fetchError) throw fetchError;
    return unchanged as Recipient;
  },

  async claimVoucher(recipientId: string, formPayload: object): Promise<ClaimResult> {
    const client = getSupabase();

    // The whole claim runs inside one Postgres transaction, in the RPC.
    // The draw uses FOR UPDATE SKIP LOCKED — never drawn in application code.
    const { data, error } = await client.rpc('draw_voucher_atomic', {
      p_recipient_id: recipientId,
      p_form_payload: formPayload,
    });

    if (error) {
      console.error('[SupabaseAdapter] claimVoucher RPC error:', error);
      throw mapRpcError(error.message);
    }

    if (!data || !data.voucher_code) {
      throw new Error('Invalid response from draw_voucher_atomic');
    }

    return { voucherCode: data.voucher_code, expiresAt: data.expires_at };
  },
};

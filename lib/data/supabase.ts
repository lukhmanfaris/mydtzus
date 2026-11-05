import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataAdapter, EntryResult } from './adapter.js';

/**
 * Writes go through the service role key, which bypasses RLS. It is a Worker
 * secret (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`) and never reaches the
 * browser. The `submissions` table denies `anon` and `authenticated` outright.
 */
export function createSupabaseAdapter(
  url: string | undefined,
  serviceRoleKey: string | undefined
): DataAdapter {
  const client = (): SupabaseClient => {
    if (!url || !serviceRoleKey) {
      throw new Error(
        'Supabase configuration missing. Set SUPABASE_URL and the ' +
          'SUPABASE_SERVICE_ROLE_KEY secret, or run locally with DATA_SOURCE=mock.'
      );
    }
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  };

  return {
    async enterCampaign(record) {
      const { data, error } = await client().rpc('enter_campaign', {
        p_referral_code: record.referral_code,
        p_full_name: record.full_name,
        p_phone: record.phone,
        p_email: record.email,
        p_company_name: record.company_name,
        p_terms_accepted_at: record.terms_accepted_at,
      });

      if (error) throw new Error(`Supabase entry failed: ${error.message}`);
      return data as EntryResult;
    },

    async hasRecentSubmission(email, phone, sinceIso) {
      const { data, error } = await client()
        .from('submissions')
        .select('id')
        .eq('email', email)
        .eq('phone', phone)
        .gte('submitted_at', sinceIso)
        .limit(1);

      if (error) throw new Error(`Supabase duplicate check failed: ${error.message}`);
      return data.length > 0;
    },

    async ping() {
      const { error } = await client().from('submissions').select('id').limit(1);
      if (error) throw new Error(`Supabase ping failed: ${error.message}`);
    },

    async allGroupsFull() {
      const { data, error } = await client()
        .from('group_capacity')
        .select('claimed, places')
        .eq('active', true);

      if (error) throw new Error(`Supabase capacity check failed: ${error.message}`);
      return data.length > 0 && data.every((g) => Number(g.claimed) >= Number(g.places));
    },
  };
}

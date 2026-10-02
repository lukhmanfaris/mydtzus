import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataAdapter } from './adapter.js';

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
    async insertSubmission(record) {
      const { data, error } = await client()
        .from('submissions')
        .insert(record)
        .select('id')
        .single();

      if (error) throw new Error(`Supabase insert failed: ${error.message}`);
      return { id: data.id as string };
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
  };
}

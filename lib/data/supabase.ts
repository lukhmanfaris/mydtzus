import { createClient } from '@supabase/supabase-js';
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
  return {
    async insertSubmission(record) {
      if (!url || !serviceRoleKey) {
        throw new Error(
          'Supabase configuration missing. Set SUPABASE_URL and the ' +
            'SUPABASE_SERVICE_ROLE_KEY secret, or run locally with DATA_SOURCE=mock.'
        );
      }

      const client = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await client
        .from('submissions')
        .insert(record)
        .select('id')
        .single();

      if (error) throw new Error(`Supabase insert failed: ${error.message}`);
      return { id: data.id as string };
    },
  };
}

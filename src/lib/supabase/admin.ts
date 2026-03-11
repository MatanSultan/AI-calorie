import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnvStrict, getSupabaseServiceRoleKeySafe } from "@/lib/supabase/config";

export function createAdminClient() {
  const { url } = getSupabasePublicEnvStrict();
  const serviceRoleKey = getSupabaseServiceRoleKeySafe();

  if (!serviceRoleKey) {
    throw new Error("Supabase service role key is missing. Set SUPABASE_SERVICE_ROLE_KEY for privileged server uploads.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

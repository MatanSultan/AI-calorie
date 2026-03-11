import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnvStrict } from "@/lib/supabase/config";

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnvStrict();
  return createBrowserClient(url, anonKey);
}


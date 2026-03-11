type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function sanitize(value: string | undefined) {
  return value?.trim();
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeJwt(value: string) {
  return value.split(".").length === 3;
}

function buildConfig(): SupabasePublicEnv | null {
  const url = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) return null;
  if (!isValidHttpUrl(url)) return null;
  if (!looksLikeJwt(anonKey)) return null;

  return { url, anonKey };
}

export function getSupabasePublicEnvStrict(): SupabasePublicEnv {
  const config = buildConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured correctly. Set valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }

  return config;
}

export function getSupabasePublicEnvSafe() {
  return buildConfig();
}

export function hasSupabaseEnv() {
  return Boolean(buildConfig());
}

export function getSupabaseServiceRoleKeySafe() {
  return sanitize(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabaseServiceRole() {
  return Boolean(getSupabaseServiceRoleKeySafe());
}

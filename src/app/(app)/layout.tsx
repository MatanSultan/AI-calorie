import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/get-locale";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language,onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const metadata = user.user_metadata as { onboarding_completed?: boolean; preferred_language?: "he" | "en" } | undefined;
  const onboardingCompleted = Boolean(profile?.onboarding_completed ?? metadata?.onboarding_completed);
  if (!onboardingCompleted) redirect("/onboarding");

  const cookieLocale = await getLocale();
  const locale = (profile?.preferred_language as "he" | "en" | null) ?? metadata?.preferred_language ?? cookieLocale;

  return <AppShell locale={locale}>{children}</AppShell>;
}


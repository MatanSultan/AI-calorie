import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardData } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/get-locale";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const locale = await getLocale();

  if (!user) redirect("/sign-in");

  const [summary, { data: recentMeals }] = await Promise.all([
    getDashboardData(),
    supabase
      .from("meal_entries")
      .select("id,title,occurred_at,total_confirmed_calories,total_estimated_calories")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("occurred_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <DashboardClient
      locale={locale}
      summary={
        summary ?? {
          todayCalories: 0,
          weeklyCalories: [],
          streakDays: 0,
          totalMeals: 0,
        }
      }
      recentMeals={recentMeals ?? []}
    />
  );
}


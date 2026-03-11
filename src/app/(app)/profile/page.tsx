import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

async function updateProfile(formData: FormData) {
  "use server";

  const preferredLanguage = String(formData.get("preferredLanguage") ?? "he") === "en" ? "en" : "he";
  const dailyRaw = Number(formData.get("dailyCalorieTarget") || 0);
  const weightRaw = Number(formData.get("weightGoalKg") || 0);
  const dailyCalorieTarget = Number.isFinite(dailyRaw) && dailyRaw > 0 ? Math.round(dailyRaw) : null;
  const weightGoalKg = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : null;

  const supabase = await createClient();
  const cookieStore = await cookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  await Promise.all([
    supabase.from("profiles").update({ preferred_language: preferredLanguage }).eq("id", user.id),
    supabase.from("user_goals").upsert({ user_id: user.id, daily_calorie_target: dailyCalorieTarget, weight_goal_kg: weightGoalKg }),
    supabase.auth.updateUser({
      data: {
        preferred_language: preferredLanguage,
      },
    }),
  ]);

  cookieStore.set("calorielens-lang", preferredLanguage, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  redirect("/profile");
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: goals }, { data: analytics }] = await Promise.all([
    supabase.from("profiles").select("full_name,preferred_language").eq("id", user.id).maybeSingle(),
    supabase.from("user_goals").select("daily_calorie_target,weight_goal_kg").eq("user_id", user.id).maybeSingle(),
    supabase.from("meal_entries").select("total_confirmed_calories,total_estimated_calories").eq("user_id", user.id),
  ]);

  const totalMeals = analytics?.length ?? 0;
  const calories = analytics?.map((m) => m.total_confirmed_calories ?? m.total_estimated_calories ?? 0) ?? [];
  const avgCalories = calories.length ? Math.round(calories.reduce((a, b) => a + b, 0) / calories.length) : 0;
  const consistency = Math.min(100, totalMeals * 5);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardTitle>פרופיל והעדפות</CardTitle>
        <CardDescription className="mt-1">
          עדכון שפה, יעדים אישיים והעדפות מעקב.
        </CardDescription>

        <form action={updateProfile} className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">שם מלא</label>
            <Input value={profile?.full_name ?? ""} readOnly />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">שפה מועדפת</label>
            <select
              name="preferredLanguage"
              defaultValue={profile?.preferred_language ?? "he"}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="he">עברית (RTL)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">יעד קלוריות יומי</label>
            <Input name="dailyCalorieTarget" type="number" defaultValue={goals?.daily_calorie_target ?? ""} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">יעד משקל (ק&quot;ג)</label>
            <Input name="weightGoalKg" type="number" step="0.1" defaultValue={goals?.weight_goal_kg ?? ""} />
          </div>

          <Button>שמירת שינויים</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>תמונת מצב</CardTitle>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-300">סה&quot;כ ארוחות מתועדות</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalMeals}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-300">ממוצע קלוריות לארוחה</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{avgCalories} kcal</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-300">עקביות תיעוד</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{consistency}%</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

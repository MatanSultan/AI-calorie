import { redirect } from "next/navigation";
import { Sparkles, Camera, MessageSquare } from "lucide-react";
import { updateOnboardingAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const metadata = user.user_metadata as { onboarding_completed?: boolean } | undefined;
  if (profile?.onboarding_completed || metadata?.onboarding_completed) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
      <Card className="w-full overflow-hidden p-0">
        <div className="bg-gradient-to-l from-emerald-600 via-cyan-600 to-blue-600 px-6 py-7 text-white">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            התחלה מהירה
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">ברוכים הבאים ל-CalorieLens</h1>
          <p className="mt-2 text-sm text-cyan-50 sm:text-base">
            מצלמים ארוחה, מקבלים הערכת קלוריות ב-AI, מתקנים אם צריך ושומרים בלחיצה.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-2 rounded-2xl bg-slate-100 p-4 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 sm:grid-cols-3">
            <p className="inline-flex items-center gap-2"><Camera className="h-4 w-4 text-emerald-600" /> מצלמים או מעלים תמונה</p>
            <p className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4 text-cyan-600" /> מדייקים בשיחה קצרה</p>
            <p className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-500" /> שומרים ומתקדמים</p>
          </div>

          <form action={updateOnboardingAction} className="space-y-4">
            {params.error ? (
              <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-900 dark:bg-rose-900/40 dark:text-rose-100">
                {params.error}
              </p>
            ) : null}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">שפה מועדפת</label>
              <select
                name="preferredLanguage"
                defaultValue="he"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="he">עברית (ברירת מחדל)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  יעד קלוריות יומי (אופציונלי)
                </label>
                <Input name="dailyCalorieTarget" type="number" inputMode="numeric" placeholder="למשל 2200" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-100">
                  יעד משקל בק&quot;ג (אופציונלי)
                </label>
                <Input name="weightGoalKg" type="number" step="0.1" inputMode="decimal" placeholder="למשל 72" />
              </div>
            </div>

            <Button className="h-12 w-full text-base">התחל עכשיו</Button>
            <CardDescription className="text-center text-xs">
              אפשר לשנות העדפות בכל שלב דרך עמוד הפרופיל.
            </CardDescription>
          </form>
        </div>
      </Card>
    </main>
  );
}

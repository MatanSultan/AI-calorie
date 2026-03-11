import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, ChartColumn, MessageSquare, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";
import { getLocale } from "@/lib/i18n/get-locale";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const locale = await getLocale();
  const rtl = locale === "he";
  const supabaseConfigured = hasSupabaseEnv();

  if (supabaseConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) redirect("/dashboard");
    } catch {
      // Keep landing available if backend is temporarily unavailable.
    }
  }

  const steps =
    locale === "he"
      ? [
          "מצלמים או מעלים תמונת ארוחה",
          "מוסיפים תיאור קצר אם צריך",
          "מקבלים הערכת קלוריות מפורטת",
          "מתקנים ושומרים בלחיצה אחת",
        ]
      : [
          "Capture or upload your meal",
          "Add a short description if needed",
          "Get itemized calorie estimate",
          "Edit and save in one click",
        ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#d9fff0_0%,#f7fafc_45%,#eef2ff_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top,#042318_0%,#020617_55%,#030712_100%)] dark:text-slate-100 sm:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <Logo />
          <div className="flex gap-2">
            <Link href="/demo">
              <Button variant="secondary">{rtl ? "ניסיון חינם" : "Free Trial"}</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost">{rtl ? "התחברות" : "Sign in"}</Button>
            </Link>
            <Link href="/sign-up">
              <Button>{rtl ? "הרשמה" : "Create account"}</Button>
            </Link>
          </div>
        </header>

        {!supabaseConfigured ? (
          <Card className="border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/40">
            <CardTitle className="text-amber-900 dark:text-amber-100">
              {rtl ? "חסרה הגדרת Supabase" : "Supabase is not configured"}
            </CardTitle>
            <CardDescription className="mt-2 text-amber-800 dark:text-amber-200">
              {rtl
                ? "יש להגדיר NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY בקובץ .env.local ולהפעיל מחדש."
                : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart."}
            </CardDescription>
          </Card>
        ) : null}

        <section className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <Card className="border-0 bg-gradient-to-br from-emerald-600 via-cyan-600 to-blue-700 p-8 text-white shadow-2xl shadow-emerald-900/30">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              {rtl ? "מעקב תזונה חכם עם AI" : "AI-powered nutrition tracking"}
            </div>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              {rtl ? "CalorieLens הופך רישום ארוחות לפשוט ומהיר" : "CalorieLens makes meal logging simple and fast"}
            </h1>
            <p className="mt-4 max-w-xl text-sm text-cyan-50 sm:text-base">
              {rtl
                ? "צלמו ארוחה, קבלו הערכת קלוריות לכל פריט, דייקו בשיחה קצרה ושמרו היסטוריה אישית מכל מכשיר."
                : "Snap your meal, get itemized calorie estimates, refine with chat, and keep your history across devices."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/demo">
                <Button className="bg-white text-slate-900 hover:bg-slate-100">
                  {rtl ? "נסו עכשיו ללא הרשמה" : "Try now without signup"}
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button variant="outline" className="border-white/50 bg-white/10 text-white hover:bg-white/20">
                  {rtl ? "פתיחת חשבון ושמירה להיסטוריה" : "Create account and save history"}
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardTitle>{rtl ? "איך משתמשים בקלות?" : "How it works"}</CardTitle>
            <CardDescription className="mt-1">
              {rtl
                ? "תהליך קצר וברור, גם בלי ידע קודם."
                : "A short and clear flow, even for first-time users."}
            </CardDescription>
            <ol className="mt-4 space-y-2 text-sm">
              {steps.map((step, index) => (
                <li key={step} className="rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Camera,
              title: rtl ? "צילום והעלאה" : "Camera & upload",
              desc: rtl ? "תמונת ארוחה עם תצוגה מהירה לפני ניתוח." : "Capture meal photo with quick preview.",
            },
            {
              icon: MessageSquare,
              title: rtl ? "שאלות הבהרה" : "Clarification chat",
              desc: rtl ? "ה-AI שואל על כמויות, רטבים ושתייה." : "AI asks about portions, sauces, and drinks.",
            },
            {
              icon: ChartColumn,
              title: rtl ? "מעקב יומי ושבועי" : "Daily & weekly tracking",
              desc: rtl ? "סיכום קלוריות, היסטוריה והמלצות." : "Calorie totals, history, and suggestions.",
            },
          ].map((item) => (
            <Card key={item.title} className="fade-up">
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon className="h-4 w-4 text-emerald-600" />
                {item.title}
              </CardTitle>
              <CardDescription className="mt-1">{item.desc}</CardDescription>
            </Card>
          ))}
        </section>

        <Card className="border-0 bg-slate-900 p-5 text-white dark:bg-slate-800">
          <CardTitle className="flex items-center gap-2 text-white">
            <WandSparkles className="h-4 w-4 text-cyan-300" />
            {rtl ? "רוצים להתנסות לפני הרשמה?" : "Want to try before signing up?"}
          </CardTitle>
          <CardDescription className="mt-1 text-slate-200">
            {rtl
              ? "מצב ניסיון חינם מאפשר ניתוח תמונה וצ'אט AI ללא שמירת נתונים."
              : "Free trial mode lets you analyze meals and chat with AI without saving data."}
          </CardDescription>
          <div className="mt-4">
            <Link href="/demo">
              <Button>{rtl ? "פתיחת ניסיון חינם" : "Open free trial"}</Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

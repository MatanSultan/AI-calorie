import Link from "next/link";
import { CalendarRange, ChevronLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMealHistory } from "@/lib/supabase/queries";
import { getLocale } from "@/lib/i18n/get-locale";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const isHebrew = locale === "he";
  const meals = await getMealHistory(params.q, params.from, params.to);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f766e_0%,#0f766e_12%,#0891b2_58%,#1d4ed8_100%)] p-0 text-white shadow-[0_32px_80px_-42px_rgba(15,23,42,0.65)]">
        <div className="grid gap-4 px-5 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <Badge className="bg-white/15 text-white hover:bg-white/15" variant="default">
              {isHebrew ? "היסטוריית ארוחות" : "Meal history"}
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {isHebrew ? "כל הארוחות השמורות במקום אחד" : "All your saved meals in one place"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50">
                {isHebrew
                  ? "חיפוש מהיר לפי שם, סינון לפי תאריך, וכניסה לכל ארוחה כדי לראות פירוט פריטים, תמונה וסיכום."
                  : "Quick search by meal name, date filters, and a full breakdown page for each saved meal."}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-slate-950/15 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white/90">{isHebrew ? "סך ארוחות שמורות" : "Total saved meals"}</p>
            <p className="mt-2 text-4xl font-bold">{meals.length}</p>
            <p className="mt-2 text-sm text-cyan-50">
              {isHebrew ? "רק ארוחות שאושרו נשמרות ומופיעות כאן." : "Only approved meals are stored and shown here."}
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="space-y-1">
          <CardTitle>{isHebrew ? "חיפוש וסינון" : "Search and filters"}</CardTitle>
          <CardDescription>
            {isHebrew ? "אפשר למצוא ארוחה לפי כותרת או לבחור טווח תאריכים." : "Find meals by title or filter by date range."}
          </CardDescription>
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute end-4 top-4 h-4 w-4 text-slate-500" />
            <Input
              name="q"
              defaultValue={params.q}
              className="pe-10"
              placeholder={isHebrew ? "חיפוש לפי כותרת הארוחה" : "Search by meal title"}
            />
          </div>
          <Input name="from" type="date" defaultValue={params.from} />
          <Input name="to" type="date" defaultValue={params.to} />
          <Button className="w-full md:w-auto">{isHebrew ? "סנן תוצאות" : "Apply filters"}</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {meals.length === 0 ? (
          <Card className="text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-4">
              <div className="rounded-full bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle>{isHebrew ? "עדיין אין ארוחות בתצוגה הזאת" : "No meals match this view yet"}</CardTitle>
                <CardDescription>
                  {isHebrew
                    ? "ברגע שתשמור ארוחה מאושרת היא תופיע כאן אוטומטית יחד עם התאריך והקלוריות."
                    : "Once you save an approved meal, it will appear here automatically with its date and calories."}
                </CardDescription>
              </div>
              <Link href="/dashboard#capture">
                <Button>{isHebrew ? "הוסף ארוחה חדשה" : "Add a new meal"}</Button>
              </Link>
            </div>
          </Card>
        ) : (
          meals.map((meal) => (
            <Link key={meal.id} href={`/history/${meal.id}`} className="block">
              <Card className="group transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-36px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{meal.title}</CardTitle>
                      <Badge variant="high">{isHebrew ? "נשמר" : "Saved"}</Badge>
                    </div>
                    <CardDescription>
                      {new Date(meal.occurred_at).toLocaleString(isHebrew ? "he-IL" : "en-US")}
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-end dark:bg-slate-900">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isHebrew ? "קלוריות" : "Calories"}</p>
                      <p className="text-lg font-bold text-slate-950 dark:text-slate-50">
                        {(meal.total_confirmed_calories ?? meal.total_estimated_calories ?? 0).toFixed(0)} kcal
                      </p>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Camera, MessageSquareText, UtensilsCrossed } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getMealDetail } from "@/lib/supabase/queries";
import { getLocale } from "@/lib/i18n/get-locale";

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const isHebrew = locale === "he";
  const detail = await getMealDetail(id);
  if (!detail) return notFound();

  const totalCalories = detail.meal.total_confirmed_calories ?? detail.meal.total_estimated_calories ?? 0;

  return (
    <div className="space-y-5">
      <Link
        href="/history"
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100"
      >
        <ArrowRight className="h-4 w-4" />
        {isHebrew ? "חזרה להיסטוריה" : "Back to history"}
      </Link>

      <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f766e_0%,#0891b2_55%,#1d4ed8_100%)] p-0 text-white shadow-[0_32px_80px_-42px_rgba(15,23,42,0.65)]">
        <div className="grid gap-5 px-5 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/15 text-white hover:bg-white/15" variant="default">
                {isHebrew ? "ארוחה שמורה" : "Saved meal"}
              </Badge>
              <Badge className="bg-white/15 text-white hover:bg-white/15" variant="default">
                {new Date(detail.meal.occurred_at).toLocaleString(isHebrew ? "he-IL" : "en-US")}
              </Badge>
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">{detail.meal.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50">
                {isHebrew
                  ? "הערכים נשמרו לאחר אישור הארוחה. אפשר לראות כאן את פירוט הפריטים, התמונה וסיכום החידוד עם AI."
                  : "These values were stored after approval. You can review the item breakdown, image, and AI refinement summary here."}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-slate-950/15 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white/90">{isHebrew ? "סך קלוריות לארוחה" : "Total meal calories"}</p>
            <p className="mt-2 text-4xl font-bold">{Math.round(totalCalories)} kcal</p>
            <p className="mt-2 text-sm text-cyan-50">
              {isHebrew ? "הסכום נשמר תחת הארוחות המאושרות בלבד." : "This total is stored only for approved meals."}
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-cyan-100 p-2 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-100">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>{isHebrew ? "פירוט פריטים" : "Meal items"}</CardTitle>
                <CardDescription>
                  {isHebrew ? "רשימת הפריטים שנשמרו יחד עם הכמות והקלוריות." : "The saved itemized breakdown with portions and calories."}
                </CardDescription>
              </div>
            </div>

            <div className="space-y-3">
              {detail.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{item.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.estimated_quantity}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={item.confidence}>{item.confidence}</Badge>
                    <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-900 dark:bg-slate-900 dark:text-slate-50">
                      {item.estimated_calories} kcal
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100">
                <MessageSquareText className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>{isHebrew ? "סיכום חידוד" : "Refinement summary"}</CardTitle>
                <CardDescription>
                  {isHebrew ? "אם דייקת את הארוחה דרך הצ'אט, הסיכום נשמר כאן." : "If you refined the meal through chat, the summary appears here."}
                </CardDescription>
              </div>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {detail.conversation?.summary ?? (isHebrew ? "לא נשמר סיכום חידוד לארוחה הזאת." : "No refinement summary was stored for this meal.")}
            </div>

            {detail.messages.length > 0 ? (
              <div className="space-y-2">
                {detail.messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.role === "assistant"
                        ? "rounded-[22px] bg-emerald-100 px-4 py-3 text-sm text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-100"
                        : "rounded-[22px] bg-slate-100 px-4 py-3 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                    }
                  >
                    <strong className="me-1">{message.role === "assistant" ? "AI:" : isHebrew ? "אתם:" : "You:"}</strong>
                    {message.content}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>{isHebrew ? "תמונת הארוחה" : "Meal image"}</CardTitle>
                <CardDescription>
                  {isHebrew ? "אם התמונה נשמרה בהצלחה, אפשר לראות אותה כאן." : "If the image was saved successfully, you can view it here."}
                </CardDescription>
              </div>
            </div>

            {detail.image?.public_url ? (
              <img
                src={detail.image.public_url}
                alt={detail.meal.title}
                className="h-[22rem] w-full rounded-[28px] object-cover"
              />
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                {isHebrew
                  ? "התמונה לא נשמרה עם הארוחה הזאת, אבל שאר נתוני הארוחה זמינים ומעודכנים."
                  : "The image was not saved with this meal, but the rest of the meal data is still available."}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <CardTitle>{isHebrew ? "הערות כלליות" : "General notes"}</CardTitle>
            <CardDescription>
              {isHebrew
                ? "הקלוריות המוצגות הן הערכה בלבד. רק ארוחות שאושרו נשמרות ומעדכנות את הסיכום היומי."
                : "Displayed calories are estimates only. Only approved meals are stored and update the daily summary."}
            </CardDescription>
          </Card>
        </div>
      </section>
    </div>
  );
}

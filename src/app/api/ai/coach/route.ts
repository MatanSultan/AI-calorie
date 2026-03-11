import { NextResponse } from "next/server";
import { startOfDayIso } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { coachChatRequestSchema } from "@/lib/validation/meal";
import { getAIProvider } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = coachChatRequestSchema.parse(await request.json());
    const todayStart = startOfDayIso(new Date());

    const [{ data: todayMeals }, { data: recentMeals }, { data: recentItems }] = await Promise.all([
      supabase
        .from("meal_entries")
        .select("id,title,total_confirmed_calories,total_estimated_calories,occurred_at")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .gte("occurred_at", todayStart),
      supabase
        .from("meal_entries")
        .select("id,title,total_confirmed_calories,total_estimated_calories,occurred_at")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .order("occurred_at", { ascending: false })
        .limit(10),
      supabase
        .from("meal_items")
        .select("name,estimated_calories,protein_g,carbs_g,fat_g,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const todayCalories =
      todayMeals?.reduce(
        (sum, meal) => sum + (meal.total_confirmed_calories ?? meal.total_estimated_calories ?? 0),
        0,
      ) ?? 0;

    const recentMealsSummary =
      recentMeals
        ?.slice(0, 5)
        .map((meal) => {
          const calories = meal.total_confirmed_calories ?? meal.total_estimated_calories ?? 0;
          return `${meal.title} (${calories} kcal)`;
        })
        .join(", ") ?? "no meals logged recently";

    const recentItemsSummary =
      recentItems
        ?.slice(0, 10)
        .map((item) => `${item.name} (${item.estimated_calories} kcal)`)
        .join(", ") ?? "no items";

    const contextNotes =
      payload.locale === "he"
        ? [
            `הקשר משתמש: סך קלוריות היום הוא ${todayCalories}.`,
            `ארוחות אחרונות: ${recentMealsSummary}.`,
            `פריטי מזון אחרונים: ${recentItemsSummary}.`,
            "הנחיה: ענה בעברית. הישאר ממוקד במעקב תזונה. אם חסר מידע, אמור זאת. אין לתת ייעוץ רפואי.",
          ]
        : [
            `User context: today's calories total is ${todayCalories}.`,
            `Recent meals: ${recentMealsSummary}.`,
            `Recent food items: ${recentItemsSummary}.`,
            "Instruction: stay focused on nutrition tracking and meal guidance, avoid medical advice, state uncertainty clearly.",
          ];

    const provider = getAIProvider();
    const text = await provider.chat({
      locale: payload.locale,
      messages: payload.messages,
      analysisContext: {
        confidence: "medium",
        contains_food: true,
        is_food: true,
        items: [],
        total_estimated_calories: todayCalories,
        follow_up_questions: [],
        notes: contextNotes,
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunks = text.match(/.{1,28}/g) ?? [text];
        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            controller.enqueue(encoder.encode(chunk));
            if (index === chunks.length - 1) controller.close();
          }, index * 20);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coach chat failed" },
      { status: 400 },
    );
  }
}

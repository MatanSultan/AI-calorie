import { subDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { endOfDayIso, startOfDayIso } from "@/lib/utils";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function getDashboardData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date();
  const sevenDaysAgo = subDays(today, 6);

  const [{ data: entries }, { data: goals }, { count: totalMealsCount }] = await Promise.all([
    supabase
      .from("meal_entries")
      .select("id,total_confirmed_calories,total_estimated_calories,occurred_at")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .gte("occurred_at", startOfDayIso(sevenDaysAgo))
      .lte("occurred_at", endOfDayIso(today))
      .order("occurred_at", { ascending: true }),
    supabase.from("user_goals").select("daily_calorie_target").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("meal_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "confirmed"),
  ]);

  const weeklyMap = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    weeklyMap.set(date, 0);
  }

  let todayCalories = 0;
  const mealCount = totalMealsCount ?? entries?.length ?? 0;

  entries?.forEach((entry) => {
    const date = format(new Date(entry.occurred_at), "yyyy-MM-dd");
    const calories = entry.total_confirmed_calories ?? entry.total_estimated_calories ?? 0;
    weeklyMap.set(date, (weeklyMap.get(date) ?? 0) + calories);
    if (date === format(today, "yyyy-MM-dd")) {
      todayCalories += calories;
    }
  });

  const weeklyCalories = Array.from(weeklyMap.entries())
    .map(([date, calories]) => ({ date, calories }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let streakDays = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    if ((weeklyMap.get(date) ?? 0) > 0) {
      streakDays += 1;
      continue;
    }
    if (i === 0) continue;
    break;
  }

  return {
    todayCalories,
    weeklyCalories,
    streakDays,
    totalMeals: mealCount,
    goal: goals?.daily_calorie_target ?? undefined,
  };
}

export async function getMealHistory(search?: string, from?: string, to?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from("meal_entries")
    .select("id,title,status,total_estimated_calories,total_confirmed_calories,occurred_at,created_at")
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .order("occurred_at", { ascending: false });

  if (from) query = query.gte("occurred_at", new Date(from).toISOString());
  if (to) query = query.lte("occurred_at", endOfDayIso(new Date(to)));

  if (search?.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getMealDetail(mealId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: meal }, { data: items }, { data: image }, { data: conversation }, { data: messages }] = await Promise.all([
    supabase.from("meal_entries").select("*").eq("id", mealId).eq("user_id", user.id).maybeSingle(),
    supabase.from("meal_items").select("*").eq("meal_entry_id", mealId).eq("user_id", user.id).order("created_at"),
    supabase.from("meal_images").select("*").eq("meal_entry_id", mealId).eq("user_id", user.id).maybeSingle(),
    supabase.from("meal_conversations").select("*").eq("meal_entry_id", mealId).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("meal_messages")
      .select("*")
      .eq("meal_entry_id", mealId)
      .eq("user_id", user.id)
      .order("created_at"),
  ]);

  if (!meal) return null;

  return {
    meal,
    items: items ?? [],
    image,
    conversation,
    messages: messages ?? [],
  };
}


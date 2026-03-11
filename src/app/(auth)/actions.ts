"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const next = String(formData.get("next") ?? "/dashboard");
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!email || !password) {
    redirect(`/sign-in?error=${encodeURIComponent("יש למלא אימייל וסיסמה.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent("פרטי ההתחברות שגויים או שהחשבון עדיין לא אומת.")}`);
  }

  redirect(safeNext);
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password) {
    redirect(`/sign-up?error=${encodeURIComponent("יש למלא אימייל וסיסמה.")}`);
  }

  if (password.length < 6) {
    redirect(`/sign-up?error=${encodeURIComponent("הסיסמה חייבת לכלול לפחות 6 תווים.")}`);
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { full_name: fullName },
    },
  });

  if (error) {
    if (/already registered/i.test(error.message)) {
      redirect(`/sign-in?error=${encodeURIComponent("האימייל כבר רשום במערכת. התחברו לחשבון הקיים.")}`);
    }
    redirect(
      `/sign-up?error=${encodeURIComponent("לא הצלחנו להשלים הרשמה. בדקו את האימייל ונסו סיסמה חזקה יותר.")}`,
    );
  }

  if (!data.user) {
    redirect(`/sign-up?error=${encodeURIComponent("לא הצלחנו להשלים הרשמה. נסו שוב.")}`);
  }

  // If email confirmation is disabled in Supabase, we may already have a session.
  if (data.session) {
    redirect("/onboarding");
  }

  redirect("/sign-in?checkEmail=1");
}

export async function updateOnboardingAction(formData: FormData) {
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "he") === "en" ? "en" : "he";
  const dailyRaw = Number(formData.get("dailyCalorieTarget") || 0);
  const weightRaw = Number(formData.get("weightGoalKg") || 0);
  const dailyCalorieTarget = Number.isFinite(dailyRaw) && dailyRaw > 0 ? Math.round(dailyRaw) : 0;
  const weightGoalKg = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const { error: metadataError } = await supabase.auth.updateUser({
    data: { onboarding_completed: true, preferred_language: preferredLanguage },
  });
  if (metadataError) {
    console.error("Onboarding metadata update failed:", metadataError);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, preferred_language: preferredLanguage, onboarding_completed: true });
  if (profileError) {
    console.error("Onboarding profile upsert failed (non-blocking fallback to metadata):", profileError);
  }

  if (metadataError && profileError) {
    redirect(`/onboarding?error=${encodeURIComponent("לא הצלחנו לשמור את ההגדרות. נסו שוב.")}`);
  }

  // Goals are optional; failure here should not block entering the platform.
  const { error: goalsError } = await supabase.from("user_goals").upsert({
    user_id: user.id,
    daily_calorie_target: dailyCalorieTarget || null,
    weight_goal_kg: weightGoalKg || null,
  });
  if (goalsError) {
    console.error("Onboarding goals upsert failed (non-blocking):", goalsError);
  }

  cookieStore.set("calorielens-lang", preferredLanguage, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  redirect("/dashboard");
}


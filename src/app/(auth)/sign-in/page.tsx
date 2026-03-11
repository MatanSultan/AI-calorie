import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/(auth)/actions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { getLocale } from "@/lib/i18n/get-locale";
import { createClient } from "@/lib/supabase/server";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkEmail?: string; next?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const isHebrew = locale === "he";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d8fce9_0%,#f4f6fb_45%,#eef2ff_100%)] p-4 dark:bg-[radial-gradient(circle_at_top,#042318_0%,#020617_55%,#030712_100%)]">
      <Card className="w-full max-w-md p-6">
        <Logo compact />
        <CardTitle className="mt-4 text-2xl">{isHebrew ? "ברוכים הבאים בחזרה" : "Welcome back"}</CardTitle>
        <CardDescription className="mt-1">
          {isHebrew ? "התחברו כדי להמשיך לתיעוד הארוחות ולמעקב היומי שלכם." : "Sign in to continue logging meals and tracking your daily progress."}
        </CardDescription>

        {params.checkEmail ? (
          <p className="mt-4 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
            {isHebrew
              ? "החשבון נוצר בהצלחה. אם הפעלתם אימות במייל, אשרו את ההרשמה ואז התחברו."
              : "Your account was created. If email confirmation is enabled, approve the email and then sign in."}
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-4 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/40 dark:text-rose-100">
            {params.error}
          </p>
        ) : null}

        <form action={signInAction} className="mt-6 space-y-3">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
          <Input name="email" type="email" required placeholder={isHebrew ? "אימייל" : "Email"} />
          <Input name="password" type="password" required placeholder={isHebrew ? "סיסמה" : "Password"} />
          <Button className="w-full">{isHebrew ? "התחברות" : "Sign in"}</Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-300">
          {isHebrew ? "עדיין אין לכם חשבון?" : "Don't have an account yet?"}{" "}
          <Link className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300" href="/sign-up">
            {isHebrew ? "להרשמה" : "Create one"}
          </Link>
        </p>
      </Card>
    </main>
  );
}

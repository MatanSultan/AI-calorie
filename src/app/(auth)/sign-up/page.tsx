import Link from "next/link";
import { signUpAction } from "@/app/(auth)/actions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { getLocale } from "@/lib/i18n/get-locale";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const isHebrew = locale === "he";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#d8fce9_0%,#f4f6fb_45%,#eef2ff_100%)] p-4 dark:bg-[radial-gradient(circle_at_top,#042318_0%,#020617_55%,#030712_100%)]">
      <Card className="w-full max-w-md p-6">
        <Logo compact />
        <CardTitle className="mt-4 text-2xl">{isHebrew ? "יצירת חשבון חדש" : "Create your account"}</CardTitle>
        <CardDescription className="mt-1">
          {isHebrew
            ? "התחילו לעקוב אחרי ארוחות בקלות עם ניתוח תמונה ושיחה חכמה."
            : "Start tracking meals easily with image analysis and a smart assistant."}
        </CardDescription>

        {params.error ? (
          <p className="mt-4 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/40 dark:text-rose-100">
            {params.error}
          </p>
        ) : null}

        <form action={signUpAction} className="mt-6 space-y-3">
          <Input name="fullName" required placeholder={isHebrew ? "שם מלא" : "Full name"} />
          <Input name="email" type="email" required placeholder={isHebrew ? "אימייל" : "Email"} />
          <Input name="password" type="password" required placeholder={isHebrew ? "סיסמה חזקה" : "Strong password"} />
          <Button className="w-full">{isHebrew ? "הרשמה והמשך" : "Create account"}</Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-300">
          {isHebrew ? "כבר יש לכם חשבון?" : "Already have an account?"}{" "}
          <Link className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300" href="/sign-in">
            {isHebrew ? "להתחברות" : "Sign in"}
          </Link>
        </p>
      </Card>
    </main>
  );
}

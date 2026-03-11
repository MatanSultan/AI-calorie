"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LanguageSwitch({ locale }: { locale: "he" | "en" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLang(next: "he" | "en") {
    document.cookie = `calorielens-lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="inline-flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
      <Button size="sm" variant={locale === "he" ? "default" : "ghost"} onClick={() => setLang("he")} disabled={pending}>
        עברית
      </Button>
      <Button size="sm" variant={locale === "en" ? "default" : "ghost"} onClick={() => setLang("en")} disabled={pending}>
        English
      </Button>
    </div>
  );
}


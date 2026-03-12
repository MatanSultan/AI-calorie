import Link from "next/link";
import { LogOut, LayoutDashboard, History, User, MessageSquare } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { dictionary } from "@/lib/i18n/dictionary";
import type { AppLocale } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
}

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/chat", icon: MessageSquare, key: "chat" as const },
  { href: "/history", icon: History, key: "history" as const },
  { href: "/profile", icon: User, key: "profile" as const },
];

export async function AppShell({ locale, children }: { locale: AppLocale; children: React.ReactNode }) {
  const copy = dictionary[locale];
  const isHebrew = locale === "he";

  return (
    <div
      dir={isHebrew ? "rtl" : "ltr"}
      className="min-h-screen bg-[radial-gradient(circle_at_top,#dff8ef_0%,#f8fbff_44%,#eef4ff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,#05261d_0%,#020617_58%,#02030a_100%)] dark:text-slate-100"
    >
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSwitch locale={locale} />
            <ThemeToggle />
            <form action={signOut}>
              <button className="inline-flex h-10 items-center gap-2 rounded-2xl border border-transparent px-3 text-sm font-medium text-slate-700 transition hover:border-slate-200 hover:bg-white dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900">
                <LogOut className="h-4 w-4" />
                {copy.logout}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 pb-24 sm:px-6 md:pb-8",
          isHebrew ? "md:grid-cols-[minmax(0,1fr)_220px]" : "md:grid-cols-[220px_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "hidden rounded-[30px] border border-white/70 bg-white/84 p-3 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/74 md:block",
            isHebrew ? "md:order-2" : "md:order-1",
          )}
        >
          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-800 transition hover:bg-emerald-50 hover:text-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                >
                  <Icon className="h-4 w-4" />
                  {copy[item.key]}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className={isHebrew ? "md:order-1" : "md:order-2"}>{children}</main>
      </div>
      <MobileBottomNav locale={locale} />
    </div>
  );
}


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, MessageSquare, PlusCircle, User } from "lucide-react";
import type { AppLocale } from "@/lib/types";
import { cn } from "@/lib/utils";

const labels = {
  he: {
    home: "בית",
    add: "הוספה",
    chat: "צ'אט",
    history: "היסטוריה",
    profile: "פרופיל",
  },
  en: {
    home: "Home",
    add: "Add",
    chat: "Chat",
    history: "History",
    profile: "Profile",
  },
} as const;

export function MobileBottomNav({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const copy = labels[locale];

  const items = [
    { href: "/dashboard", icon: Home, label: copy.home },
    { href: "/dashboard#capture", icon: PlusCircle, label: copy.add },
    { href: "/chat", icon: MessageSquare, label: copy.chat },
    { href: "/history", icon: History, label: copy.history },
    { href: "/profile", icon: User, label: copy.profile },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/85 px-3 py-2 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/88 md:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl py-2 text-xs font-medium transition-all",
                  active
                    ? "bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,182,212,0.12))] text-emerald-900 shadow-sm dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.28),rgba(8,145,178,0.18))] dark:text-emerald-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

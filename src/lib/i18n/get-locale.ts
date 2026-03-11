import { cookies } from "next/headers";
import type { AppLocale } from "@/lib/types";

export async function getLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const lang = cookieStore.get("calorielens-lang")?.value;
  return lang === "en" ? "en" : "he";
}


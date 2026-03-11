import { DemoClient } from "@/components/demo/demo-client";
import { getLocale } from "@/lib/i18n/get-locale";

export default async function DemoPage() {
  const locale = await getLocale();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#d9fff0_0%,#f7fafc_45%,#eef2ff_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top,#042318_0%,#020617_55%,#030712_100%)] dark:text-slate-100 sm:p-8">
      <DemoClient locale={locale} />
    </main>
  );
}

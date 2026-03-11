import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <Card className="h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
        <Card className="h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
        <Card className="h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
        <Card className="h-28 animate-pulse bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800" />
        <Card className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

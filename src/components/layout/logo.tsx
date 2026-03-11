import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="inline-flex items-center gap-2">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500 shadow-lg shadow-emerald-500/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12c2.5-4.5 5.5-7 9-7s6.5 2.5 9 7c-2.5 4.5-5.5 7-9 7s-6.5-2.5-9-7z" />
          <circle cx="12" cy="12" r="2.8" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span>
          <span className="block text-lg font-bold tracking-tight text-slate-900 dark:text-white">CalorieLens</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Nutrition intelligence</span>
        </span>
      )}
    </Link>
  );
}


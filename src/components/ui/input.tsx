import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-12 w-full rounded-2xl border border-slate-300/90 bg-white px-4 text-start text-sm font-medium text-slate-950 placeholder:text-slate-500 outline-none ring-emerald-500/25 transition focus:border-emerald-300 focus:ring-4 dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-50 dark:placeholder:text-slate-400",
          className,
        )}
        {...props}
      />
    );
  },
);


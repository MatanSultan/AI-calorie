import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-28 w-full rounded-2xl border border-slate-300/90 bg-white px-4 py-3 text-start text-sm font-medium text-slate-950 placeholder:text-slate-500 outline-none ring-emerald-500/25 transition focus:border-emerald-300 focus:ring-4 dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-50 dark:placeholder:text-slate-400",
          className,
        )}
        {...props}
      />
    );
  },
);


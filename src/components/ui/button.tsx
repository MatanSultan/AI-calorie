import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,#10b981_0%,#06b6d4_100%)] text-white shadow-[0_18px_38px_-18px_rgba(6,182,212,0.8)] hover:brightness-[1.03]",
        secondary: "bg-slate-200/90 text-slate-950 shadow-sm hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        ghost: "text-slate-800 hover:bg-slate-100/90 dark:text-slate-100 dark:hover:bg-slate-800/90",
        destructive: "bg-[linear-gradient(135deg,#f43f5e_0%,#ef4444_100%)] text-white shadow-[0_18px_38px_-18px_rgba(244,63,94,0.75)] hover:brightness-[1.03]",
        outline: "border border-slate-300/80 bg-white/80 text-slate-800 shadow-sm hover:bg-white dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-100 dark:hover:bg-slate-900",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-xl px-3 text-xs",
        lg: "h-12 px-6 text-[15px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});


"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { buttonHover, buttonTap } from "@/lib/motion";

type Variant = "brand" | "primary" | "secondary" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type Props = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
};

const variants: Record<Variant, string> = {
  brand: "pill-gradient bg-brand text-brand-foreground shadow-blue-pill hover:bg-brand-dark",
  primary: "bg-primary text-brand-foreground hover:bg-primary-dark",
  secondary: "pill-gradient bg-brand-soft text-brand shadow-blue-pill hover:bg-brand/10",
  outline: "border-2 border-border bg-card text-foreground hover:bg-muted",
  danger: "border-2 border-destructive/30 bg-destructive/10 text-destructive",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "brand",
  size = "md",
  className,
  children,
  disabled,
  type = "button",
  onClick,
}: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled || reduce ? undefined : buttonHover}
      whileTap={disabled || reduce ? undefined : buttonTap}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

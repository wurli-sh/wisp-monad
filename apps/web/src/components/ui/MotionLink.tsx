"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonHover, buttonTap } from "@/lib/motion";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: "brand" | "outline";
};

export function MotionLink({
  href,
  children,
  className,
  variant = "outline",
}: Props) {
  const reduce = useReducedMotion();
  const styles =
    variant === "brand"
      ? "pill-gradient bg-brand text-brand-foreground shadow-blue-pill"
      : "border-2 border-border bg-card text-foreground hover:border-border-strong";

  return (
    <motion.div
      whileHover={reduce ? undefined : buttonHover}
      whileTap={reduce ? undefined : buttonTap}
      className="inline-flex"
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
          styles,
          className,
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
}

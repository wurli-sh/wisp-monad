"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonTap } from "@/lib/motion";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: "brand" | "outline";
};

type MotionButtonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "brand" | "outline";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick: () => void;
};

function motionStyles(variant: "brand" | "outline") {
  return variant === "brand"
    ? "bg-brand text-brand-foreground shadow-action hover:bg-brand-dark"
    : "border-2 border-border bg-card text-foreground hover:border-border-strong";
}

export function MotionLink({
  href,
  children,
  className,
  variant = "outline",
}: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileTap={reduce ? undefined : buttonTap}
      className="inline-flex"
    >
      <Link
        href={href}
        className={cn(
          "radius-control inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          motionStyles(variant),
          className,
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
}

export function MotionButton({
  children,
  className,
  variant = "outline",
  type = "button",
  disabled = false,
  onClick,
}: MotionButtonProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      whileTap={reduce ? undefined : buttonTap}
      className="inline-flex"
    >
      <button
        data-motion-button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "radius-control inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-100 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50",
          motionStyles(variant),
          className,
        )}
      >
        {children}
      </button>
    </motion.div>
  );
}

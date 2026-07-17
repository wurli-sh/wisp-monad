"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { buttonTap } from "@/lib/motion";
import { UsdcIcon } from "@/components/UsdcIcon";

type Props = {
  label?: string;
  amount: string;
  recipient?: string;
  note?: string;
  status?: string;
  className?: string;
  compact?: boolean;
  /** Hide the Wisp / label header row */
  hideHeader?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
};

export function WispVisaCard({
  label = "Private note",
  amount,
  recipient,
  note,
  status = "sent silently",
  className,
  compact = false,
  hideHeader = false,
  children,
  footer,
}: Props) {
  return (
    <div
      className={cn(
        "relative z-0 isolate radius-surface overflow-hidden border border-border/80 bg-card p-2 shadow-card",
        className,
      )}
    >
      <div
        className={cn(
          "relative z-0 isolate radius-surface-inner overflow-hidden border border-brand-dark/40 bg-brand text-white [clip-path:inset(0_round_var(--radius-surface-inner))]",
          compact ? "p-5 sm:p-6" : "p-6 sm:p-7",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1 bottom-2 select-none text-[4rem] font-black leading-none tracking-tighter text-white/[0.08] sm:text-[5rem]"
        >
          WISP
        </span>

        {!hideHeader && (
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wisp-logo.svg"
                alt=""
                className="h-5 w-auto brightness-0 invert sm:h-6"
              />
              <div>
                <p className="text-sm font-semibold tracking-tight">Wisp</p>
                <p className="text-[11px] text-white/70">{label}</p>
              </div>
            </div>
            {status && (
              <span className="radius-control bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                {status}
              </span>
            )}
          </div>
        )}

        {hideHeader && status && (
          <div className="relative z-10 flex justify-end">
            <span className="radius-control bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              {status}
            </span>
          </div>
        )}

        <p
          className={cn(
            "relative z-10 font-bold tracking-tight",
            hideHeader
              ? compact
                ? "mt-2 text-3xl sm:text-4xl"
                : "mt-4 text-4xl sm:text-5xl"
              : compact
                ? "mt-6 text-3xl sm:text-4xl"
                : "mt-8 text-4xl sm:text-5xl",
          )}
        >
          <span className="inline-flex items-center gap-2">
            {amount}
            <UsdcIcon className="size-5 sm:size-6" />
            <span className="text-lg font-semibold text-white/90 sm:text-xl">
              USDC
            </span>
          </span>
        </p>

        {recipient && (
          <p className="relative z-10 mt-2 text-base text-white/80 sm:text-lg">
            to {recipient}
          </p>
        )}

        {note && (
          <p className="relative z-10 mt-4 text-sm leading-snug text-white/85">
            {note}
          </p>
        )}

        {children && <div className="relative z-10 mt-4">{children}</div>}
      </div>
      {footer && <div className="px-1 pb-1 pt-3">{footer}</div>}
    </div>
  );
}

export function MotionPillButton({
  children,
  className,
  disabled,
  "aria-busy": ariaBusy,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-busy"?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      data-motion-button
      type={type}
      disabled={disabled}
      aria-busy={ariaBusy || undefined}
      onClick={onClick}
      whileTap={disabled || reduce ? undefined : buttonTap}
      className={cn(
        "radius-control inline-flex min-h-10 w-auto cursor-pointer items-center justify-center gap-2 border border-border/70 px-3.5 py-1.5 text-sm font-medium transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50",
        className?.match(/(?:^|\s)bg-/)
          ? undefined
          : "bg-muted text-foreground hover:bg-selection",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** Mid-ellipsis truncate for long claim URLs */
export function truncateMiddle(value: string, head = 28, tail = 14): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

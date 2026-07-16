"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const DEFAULT_MS = 400;

/**
 * Holds a shimmer skeleton for a minimum duration on mount, then fades to children.
 * Softens abrupt first paint on app routes.
 */
export function PageShimmer({
  skeleton,
  children,
  minMs = DEFAULT_MS,
  animateContent = true,
}: {
  skeleton: ReactNode;
  children: ReactNode;
  minMs?: number;
  animateContent?: boolean;
}) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ms = reduce ? 0 : minMs;
    if (ms <= 0) {
      setReady(true);
      return;
    }
    const id = window.setTimeout(() => setReady(true), ms);
    return () => window.clearTimeout(id);
  }, [minMs, reduce]);

  return (
    <AnimatePresence mode="wait">
      {!ready ? (
        <motion.div
          key="shimmer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={reduce || !animateContent ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce || !animateContent
              ? { duration: 0 }
              : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

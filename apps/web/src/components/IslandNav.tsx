"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { buttonHover, buttonTap } from "@/lib/motion";

export function IslandNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const lastY = useRef(0);
  const router = useRouter();
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      setHidden(y > 120 && y > lastY.current);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => setSession(data.session));
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
      return () => sub.subscription.unsubscribe();
    } catch {
      setSession(null);
    }
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className={`flex origin-top items-center gap-1 rounded-full bg-primary text-primary-foreground transition-all duration-400 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none ${
          hidden
            ? "pointer-events-none -translate-y-[150%] scale-75 opacity-0"
            : "pointer-events-auto translate-y-0 scale-100 opacity-100"
        } ${
          scrolled
            ? "px-2.5 py-3 shadow-lg shadow-primary/25"
            : "px-4 py-3.5 shadow-md shadow-primary/10"
        }`}
      >
        <Link href="/" className="flex items-center pl-2 pr-4 sm:pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wisp-logo.svg" alt="Wisp" className="h-5 w-auto" />
        </Link>
        {session && (
          <>
            {(
              [
                ["/send", "Send"],
                ["/inbox", "Inbox"],
                ["/account", "Account"],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-full px-2 py-1.5 text-xs font-medium text-primary-foreground/80 transition-colors hover:bg-white/10 hover:text-primary-foreground sm:px-3 sm:text-sm"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={signOut}
              className="rounded-full px-2 py-1.5 text-xs font-medium text-primary-foreground/60 transition-colors hover:bg-white/10 hover:text-primary-foreground sm:px-3 sm:text-sm"
            >
              Sign out
            </button>
          </>
        )}
        {session === null && (
          <motion.div whileHover={reduce ? undefined : buttonHover} whileTap={reduce ? undefined : buttonTap}>
            <Link
              href="/register"
              className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-foreground shadow-blue-pill"
            >
              Sign in
            </Link>
          </motion.div>
        )}
      </div>
    </header>
  );
}

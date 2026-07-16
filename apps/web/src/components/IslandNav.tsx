"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { buttonTap } from "@/lib/motion";
import { SignInModal } from "@/components/SignInModal";
import { useInboxUnlock } from "@/components/InboxUnlockProvider";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  ["/send", "Send"],
  ["/inbox", "Inbox"],
  ["/account", "Account"],
] as const;

export function IslandNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [signInOpen, setSignInOpen] = useState(false);
  const lastY = useRef(0);
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { clearUnlock } = useInboxUnlock();

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
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
        setSession(s),
      );
      return () => sub.subscription.unsubscribe();
    } catch {
      setSession(null);
    }
  }, []);

  async function signOut() {
    clearUnlock();
    await createClient().auth.signOut();
    setSignInOpen(true);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div
          className={cn(
            "radius-control grid w-full max-w-lg origin-top grid-cols-[1fr_auto_1fr] items-center bg-nav text-nav-foreground transition-[transform,opacity,box-shadow] duration-300 ease-out motion-reduce:transition-none sm:max-w-xl",
            hidden
              ? "pointer-events-none -translate-y-[150%] scale-75 opacity-0"
              : "pointer-events-auto translate-y-0 scale-100 opacity-100",
            scrolled
              ? "px-3 py-3 shadow-lg shadow-primary/25 sm:px-5"
              : "px-4 py-3.5 shadow-md shadow-primary/10 sm:px-6",
          )}
        >
          <Link href="/" className="justify-self-start pl-1 sm:pl-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wisp-logo.svg" alt="Wisp" className="h-5 w-auto" />
          </Link>

          <LayoutGroup id="primary-navigation">
            <nav className="flex items-center justify-center gap-0.5 sm:gap-1">
              {NAV_LINKS.map(([href, label]) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "radius-control relative px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-nav sm:px-4 sm:text-sm",
                      active
                        ? "text-nav-foreground"
                        : "text-nav-foreground/75 hover:bg-nav-hover hover:text-nav-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="tab-panel"
                        initial={false}
                        transition={
                          reduce
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 360, damping: 36 }
                        }
                        className="radius-control absolute inset-0 bg-nav-active"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </LayoutGroup>

          <div className="justify-self-end pr-1 sm:pr-2">
            {session && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="radius-control cursor-pointer bg-nav-hover px-2.5 py-1.5 text-xs font-medium text-nav-foreground/75 transition-colors hover:bg-nav-active hover:text-nav-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-nav sm:px-4 sm:text-sm"
              >
                Sign out
              </button>
            )}
            {session === null && (
              <motion.div whileTap={reduce ? undefined : buttonTap}>
                <button
                  data-motion-button
                  type="button"
                  onClick={() => setSignInOpen(true)}
                  className="radius-control cursor-pointer bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-foreground shadow-action transition-colors duration-100 ease-out hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-nav"
                >
                  Sign in
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </header>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}

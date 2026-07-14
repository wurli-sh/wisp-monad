import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/onest";
import { IslandNav } from "@/components/IslandNav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisp — Private USDC on Monad",
  description:
    "Send USDC to an X handle or email on Monad testnet. Deposit and claim are unlinkable on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <IslandNav />
          <main className="mx-auto min-h-svh max-w-5xl px-4 pb-12 pt-28">{children}</main>
          <footer className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pb-10 text-sm text-muted-foreground">
            <Link href="/" className="flex items-center gap-2 opacity-70 hover:opacity-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wisp-logo.svg" alt="" className="h-4 w-auto brightness-0" />
              <span className="text-sm font-bold tracking-tight text-foreground">Wisp</span>
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

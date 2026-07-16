import type { Metadata } from "next";
import "@fontsource-variable/onest";
import { AppChrome } from "@/components/AppChrome";
import { IslandNav } from "@/components/IslandNav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisp — Pay any handle, privately",
  description: "Send money to an @handle or email. Simple, and private.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <IslandNav />
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}

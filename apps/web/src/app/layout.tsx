import type { Metadata } from "next";
import "@fontsource-variable/onest";
import { AppChrome } from "@/components/AppChrome";
import { IslandNav } from "@/components/IslandNav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisp — Pay any handle, privately",
  description: "Send money to an @handle or email. Simple, and private.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
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

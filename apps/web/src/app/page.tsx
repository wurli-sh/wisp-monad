"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HeroSendBox } from "@/components/HeroSendBox";
import { HowItWorks } from "@/components/HowItWorks";
import { PageShimmer } from "@/components/PageShimmer";
import { GoogleIcon, XBrandIcon } from "@/components/icons";
import { LandingSkeleton } from "@/components/ui/Skeleton";
import { MotionButton } from "@/components/ui/MotionLink";
import { createClient } from "@/lib/supabase/client";
import {
  toSupabaseProvider,
  type WispOAuthProvider,
} from "@/lib/supabase/providers";

function HomeContent() {
  const [authProvider, setAuthProvider] = useState<WispOAuthProvider | null>(null);

  async function startOAuth(provider: WispOAuthProvider) {
    if (authProvider) return;
    setAuthProvider(provider);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: toSupabaseProvider(provider),
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account?tab=wallet")}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setAuthProvider(null);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-20 pb-24 text-center">
        <div className="flex min-h-[calc(100svh-7rem)] w-full max-w-3xl flex-col justify-center space-y-8">
          <h1 className="animate-rise text-6xl font-extrabold leading-[0.95] tracking-tighter text-foreground sm:text-8xl">
            Pay anyone by handle.
            <br />
            Quietly.
          </h1>
          <p className="animate-rise mx-auto max-w-xl text-lg text-muted-foreground [animation-delay:100ms]">
            Type a handle or email. Hit pay. No wallet addresses exchanged.
          </p>

          <div className="animate-rise flex flex-col items-center gap-5 [animation-delay:200ms]">
            <HeroSendBox />
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Getting paid? Open your private inbox.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <MotionButton
                  disabled={authProvider !== null}
                  onClick={() => void startOAuth("google")}
                >
                  <GoogleIcon className="h-4 w-4" />
                  Continue with Google
                </MotionButton>
                <MotionButton
                  disabled={authProvider !== null}
                  onClick={() => void startOAuth("x")}
                >
                  <XBrandIcon className="h-4 w-4" />
                  Continue with X
                </MotionButton>
              </div>
            </div>
          </div>
        </div>

        <HowItWorks />
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <PageShimmer skeleton={<LandingSkeleton />}>
      <HomeContent />
    </PageShimmer>
  );
}

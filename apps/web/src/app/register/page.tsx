"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AccountSkeleton } from "@/components/ui/Skeleton";
import { PageShimmer } from "@/components/PageShimmer";

function RegisterRedirect() {
  const params = useSearchParams();

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set("tab", "wallet");
    const provider = params.get("provider");
    const authError = params.get("authError");
    if (provider) qs.set("provider", provider);
    if (authError) qs.set("authError", authError);
    window.location.replace(`/account?${qs.toString()}`);
  }, [params]);

  return (
    <p className="text-center text-sm text-muted-foreground" role="status">
      Opening account…
    </p>
  );
}

export default function RegisterPage() {
  return (
    <PageShimmer skeleton={<AccountSkeleton />}>
      <Suspense fallback={<AccountSkeleton />}>
        <RegisterRedirect />
      </Suspense>
    </PageShimmer>
  );
}

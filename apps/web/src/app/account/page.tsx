"use client";

import { Suspense } from "react";
import { AccountView } from "@/components/AccountView";
import { PageShimmer } from "@/components/PageShimmer";
import { AccountSkeleton } from "@/components/ui/Skeleton";

export default function AccountPage() {
  return (
    <PageShimmer skeleton={<AccountSkeleton />}>
      <Suspense fallback={<AccountSkeleton />}>
        <AccountView />
      </Suspense>
    </PageShimmer>
  );
}

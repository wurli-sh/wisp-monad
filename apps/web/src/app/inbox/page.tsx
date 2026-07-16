"use client";

import { Suspense } from "react";
import { InboxView } from "@/components/InboxView";
import { PageShimmer } from "@/components/PageShimmer";
import { InboxSkeleton } from "@/components/ui/Skeleton";

export default function InboxPage() {
  return (
    <PageShimmer skeleton={<InboxSkeleton />} animateContent={false}>
      <Suspense fallback={<InboxSkeleton />}>
        <InboxView />
      </Suspense>
    </PageShimmer>
  );
}

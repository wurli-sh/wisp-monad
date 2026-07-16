"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClaimClient } from "@/components/ClaimClient";
import { PageShell } from "@/components/PageShell";
import { SendForm } from "@/components/SendForm";
import { PageShimmer } from "@/components/PageShimmer";
import { NoteCardSkeleton, SendFormSkeleton } from "@/components/ui/Skeleton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

type SendTab = "send" | "claim";

function parseTab(raw: string | null): SendTab {
  return raw === "claim" ? "claim" : "send";
}

function SendPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = parseTab(params.get("tab"));

  const setTab = useCallback(
    (next: SendTab) => {
      const qs = new URLSearchParams(params.toString());
      if (next === "send") qs.delete("tab");
      else qs.set("tab", next);
      const search = qs.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <PageShell
      title={tab === "claim" ? "Claim" : "Send"}
      subtitle={
        tab === "claim"
          ? "Open a link. Claim what’s waiting."
          : "Pay a handle or email. Quietly."
      }
      maxWidth="md"
    >
      <div className="mb-6 flex justify-center">
        <SegmentedTabs
          items={[
            { value: "send", label: "Send" },
            { value: "claim", label: "Claim" },
          ]}
          value={tab}
          onValueChange={setTab}
          ariaLabel="Send sections"
          layoutId="send-sections"
          itemClassName="px-4 py-2"
        />
      </div>

      {tab === "send" ? (
        <Suspense fallback={<SendFormSkeleton />}>
          <SendForm />
        </Suspense>
      ) : (
        <Suspense fallback={<NoteCardSkeleton />}>
          <ClaimClient embedded />
        </Suspense>
      )}
    </PageShell>
  );
}

export function SendPageClient() {
  return (
    <PageShimmer skeleton={<SendFormSkeleton />}>
      <Suspense fallback={<SendFormSkeleton />}>
        <SendPageInner />
      </Suspense>
    </PageShimmer>
  );
}

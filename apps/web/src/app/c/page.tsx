"use client";

import { useEffect } from "react";

/** Compact fragment-only claim links — open in the full Claim experience. */
export default function CompactClaimPage() {
  useEffect(() => {
    const hash = window.location.hash;
    window.location.replace(`/send?tab=claim${hash}`);
  }, []);

  return (
    <p className="text-center text-sm text-muted-foreground" role="status">
      Opening claim…
    </p>
  );
}

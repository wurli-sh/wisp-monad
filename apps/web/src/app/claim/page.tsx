"use client";

import { useEffect } from "react";

/** Legacy `/claim#p=` links — hand off to Send → Claim, preserving the fragment. */
export default function ClaimPage() {
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

"use client";

import { Suspense } from "react";
import { SendForm } from "@/components/SendForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SendPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 w-full max-w-xl" />}>
      <SendForm />
    </Suspense>
  );
}

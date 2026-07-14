"use client";

import { Suspense } from "react";
import { RegisterFlow } from "@/components/RegisterFlow";
import { Skeleton } from "@/components/ui/Skeleton";

export default function RegisterPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-64 w-full max-w-lg" />}>
      <RegisterFlow />
    </Suspense>
  );
}

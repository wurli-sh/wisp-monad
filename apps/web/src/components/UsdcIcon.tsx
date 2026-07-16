import Image from "next/image";
import { cn } from "@/lib/cn";

export function UsdcIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/usdc-logo.png"
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={cn("size-4 shrink-0", className)}
    />
  );
}

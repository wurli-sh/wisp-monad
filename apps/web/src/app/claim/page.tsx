import { ClaimClient } from "@/components/ClaimClient";

/** Secret-free SSR shell — payload is read only in the client from #p=. */
export default function ClaimPage() {
  return <ClaimClient />;
}

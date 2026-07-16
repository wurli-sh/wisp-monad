"use client";

import { PageShell } from "@/components/PageShell";
import { PageShimmer } from "@/components/PageShimmer";
import { PrivacySkeleton } from "@/components/ui/Skeleton";

function PrivacyContent() {
  return (
    <PageShell
      title="Privacy"
      subtitle="What stays private — and what doesn’t."
      maxWidth="md"
    >
      <div className="space-y-8">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Built for private payments. Here’s the straight story. Wisp on Monad is a
          hackathon / testnet system. It is not audited, not mainnet-ready, and not
          suitable for meaningful funds.
        </p>

        <section>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            What is private
          </h2>
          <ul className="mt-3 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Deposits and claims do not include a deposit commitment or leaf index in claim
              calldata. Membership is proven with a Groth16 proof over a Poseidon Merkle tree.
            </li>
            <li>
              Registered recipients receive ciphertext only; the backend cannot read note
              contents.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Honest limits
          </h2>
          <ul className="mt-3 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Amounts are fixed denominations (1 / 10 / 50 / 100 USDC), not hidden arbitrary
              balances.
            </li>
            <li>The anonymity set is small on testnet.</li>
            <li>The claim transaction sender pays MON gas and is visible on-chain.</li>
            <li>
              Unregistered email invites are delivered by Resend; the email provider can see the
              bearer claim link.
            </li>
            <li>Unregistered X sends are copy-link only — not identity-locked.</li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}

export default function PrivacyPage() {
  return (
    <PageShimmer skeleton={<PrivacySkeleton />}>
      <PrivacyContent />
    </PageShimmer>
  );
}

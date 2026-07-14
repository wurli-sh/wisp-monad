export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p>
        Wisp on Monad is a hackathon / testnet system. It is not audited, not mainnet-ready,
        and not suitable for meaningful funds.
      </p>
      <h2 className="text-xl font-bold">What is private</h2>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          Deposits and claims do not include a deposit commitment or leaf index in claim
          calldata. Membership is proven with a Groth16 proof over a Poseidon Merkle tree.
        </li>
        <li>
          Registered recipients receive ciphertext only; the backend cannot read note
          contents.
        </li>
      </ul>
      <h2 className="text-xl font-bold">Honest limits</h2>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Amounts are fixed denominations (1 / 10 / 50 / 100 USDC), not hidden arbitrary balances.</li>
        <li>The anonymity set is small on testnet.</li>
        <li>The claim transaction sender pays MON gas and is visible on-chain.</li>
        <li>
          Unregistered email invites are delivered by Resend; the email provider can see the
          bearer claim link.
        </li>
        <li>Unregistered X sends are copy-link only — not identity-locked.</li>
      </ul>
    </article>
  );
}

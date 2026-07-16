/** Concise user-facing error lines for toasts. Full detail stays in console. */
const FRIENDLY: [RegExp, string][] = [
  [/user rejected|rejected the request|denied transaction|User rejected/i, "Request cancelled."],
  [/insufficient.*usdc|Insufficient Circle USDC/i, "Not enough USDC."],
  [/Need MON for gas/i, "Need MON for gas."],
  [/Switch your wallet|wrong network|chain/i, "Switch to Monad testnet."],
  [/Wallet not connected|Connect a wallet/i, "Connect your wallet."],
  [/AbortError|aborted|cancelled|canceled/i, "Cancelled."],
  [/email consent/i, "Email consent required."],
  [/Sign in before/i, "Sign in first."],
  [/Failed to fetch|NetworkError|Load failed/i, "Network error — try again."],
  [/Commitment mismatch|Invalid claim|No claim payload/i, "Invalid claim link."],
  [/indexer syncing|Indexer unavailable|Indexer leaf gap|Indexer root mismatch|RPC unavailable/i, "Indexer still catching up — try again."],
];

export function friendlyError(err: unknown, fallback = "Something went wrong."): string {
  const msg = err instanceof Error ? err.message : String(err ?? fallback);
  for (const [re, friendly] of FRIENDLY) {
    if (re.test(msg)) return friendly;
  }
  if (msg.length <= 72) return msg;
  return fallback;
}

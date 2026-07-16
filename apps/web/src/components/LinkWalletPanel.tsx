"use client";

import { useState } from "react";
import {
  buildInboxKeyMessage,
  deriveInboxPubkeyFromSignature,
} from "@wisp/crypto/signature";
import { useConnect, useSignMessage, useSwitchChain } from "wagmi";
import { getAccount } from "@wagmi/core";
import { injected } from "wagmi/connectors";
import { monadTestnet } from "viem/chains";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { wagmiConfig } from "@/lib/wagmi";
import { friendlyError } from "@/lib/toast";
import type { ApiMeResponse } from "@/lib/api-contracts";

type Props = {
  token: string;
  onLinked?: () => void | Promise<void>;
};

export function LinkWalletPanel({ token, onLinked }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  async function linkWallet() {
    setBusy(true);
    setStatus(null);
    try {
      if (!getAccount(wagmiConfig).address) {
        await connectAsync({ connector: injected() });
      }
      if (getAccount(wagmiConfig).chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }
      const connected = getAccount(wagmiConfig);
      if (!connected.address || connected.chainId !== monadTestnet.id) {
        throw new Error("Connect a wallet on Monad testnet");
      }
      const addr = connected.address;
      const challenge = await apiFetch<{ challenge: string; expiresAt: string }>(
        "/v1/wallet/challenge",
        {
          method: "POST",
          token,
          body: { address: addr, chainId: monadTestnet.id },
        },
      );
      const signature = await signMessageAsync({ message: challenge.challenge });
      const meData = await apiFetch<ApiMeResponse>("/v1/me", { token });
      const inboxMsg = buildInboxKeyMessage(meData.userId, monadTestnet.id);
      const inboxSignature = await signMessageAsync({ message: inboxMsg });
      const inboxPubkey = deriveInboxPubkeyFromSignature(inboxSignature);
      await apiFetch("/v1/wallet/link", {
        method: "POST",
        token,
        body: {
          address: addr,
          chainId: monadTestnet.id,
          signature,
          challenge: challenge.challenge,
          inboxSignature,
          inboxPubkey,
        },
      });
      toast.success("Wallet linked");
      await onLinked?.();
    } catch (e) {
      const msg = friendlyError(e, "Wallet link failed.");
      setStatus(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        One signature to link your wallet. We never hold your keys.
      </p>
      <Button className="w-full" disabled={busy} onClick={() => void linkWallet()}>
        {busy ? (
          <TextShimmer>Linking…</TextShimmer>
        ) : (
          <>
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Connect & link wallet
          </>
        )}
      </Button>
      {status && <p className="text-sm text-destructive">{status}</p>}
    </div>
  );
}

import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { http as wagmiHttp, createConfig } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import deployment from "../../../../deployments/10143.json";
import { parseDeploymentManifest, type DeploymentManifest } from "@wisp/shared";

export const manifest: DeploymentManifest = parseDeploymentManifest(deployment);

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL),
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [monadTestnet.id]: wagmiHttp(process.env.NEXT_PUBLIC_MONAD_RPC_URL),
  },
  ssr: true,
});

export const USDC_ADDRESS = manifest.token.address;
export const USDC_DECIMALS = manifest.token.decimals;
export const CIRCUIT_ID = manifest.circuitId;
export const EXPLORER_ORIGIN = new URL(
  manifest.pools["1000000"].explorerUrl,
).origin;

export function transactionExplorerUrl(hash: string): string {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("invalid transaction hash");
  return `${EXPLORER_ORIGIN}/tx/${hash}`;
}

export function addressExplorerUrl(address: string): string {
  if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new Error("invalid address");
  return `${EXPLORER_ORIGIN}/address/${address}`;
}

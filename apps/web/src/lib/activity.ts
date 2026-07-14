import {
  poolByDenom,
  type DeploymentManifest,
  type Hex32,
} from "@wisp/shared";

export const sentDeliveryKinds = [
  "registered",
  "email",
  "claim_link",
  "recovery_required",
] as const;

export type SentDeliveryKind = (typeof sentDeliveryKinds)[number];

export type SentActivityPayload = {
  v: 1;
  kind: "sent";
  recipient: string;
  displayRecipient: string;
  denomination: string;
  pool: `0x${string}`;
  commitment: Hex32;
  depositTxHash: Hex32;
  delivery: SentDeliveryKind;
  createdAt: string;
};

function isHex(value: unknown, bytes: number): value is `0x${string}` {
  return (
    typeof value === "string" &&
    new RegExp(`^0x[0-9a-f]{${bytes * 2}}$`, "i").test(value)
  );
}

export function encodeSentActivity(payload: SentActivityPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

export function decodeSentActivity(
  plaintext: Uint8Array,
  deployment: DeploymentManifest,
): SentActivityPayload {
  const raw = JSON.parse(new TextDecoder().decode(plaintext)) as Record<
    string,
    unknown
  >;
  if (
    raw.v !== 1 ||
    raw.kind !== "sent" ||
    typeof raw.recipient !== "string" ||
    typeof raw.displayRecipient !== "string" ||
    typeof raw.denomination !== "string" ||
    !isHex(raw.pool, 20) ||
    !isHex(raw.commitment, 32) ||
    !isHex(raw.depositTxHash, 32) ||
    !sentDeliveryKinds.includes(raw.delivery as SentDeliveryKind) ||
    typeof raw.createdAt !== "string" ||
    !Number.isFinite(Date.parse(raw.createdAt))
  ) {
    throw new Error("Invalid sent activity");
  }
  const expectedPool = poolByDenom(deployment, BigInt(raw.denomination));
  if (!expectedPool || expectedPool.toLowerCase() !== raw.pool.toLowerCase()) {
    throw new Error("Sent activity deployment mismatch");
  }
  return raw as SentActivityPayload;
}

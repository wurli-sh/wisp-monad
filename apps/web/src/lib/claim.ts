import {
  claimPayloadV1Schema,
  poolByDenom,
  type ClaimPayloadV1,
  type DeploymentManifest,
} from "@wisp/shared";

export function parseTrustedClaimPayload(
  raw: unknown,
  deployment: DeploymentManifest,
): ClaimPayloadV1 {
  const payload = claimPayloadV1Schema.parse(raw) as ClaimPayloadV1;
  const expectedPool = poolByDenom(deployment, BigInt(payload.denomination));

  if (!expectedPool || expectedPool.toLowerCase() !== payload.pool.toLowerCase()) {
    throw new Error("Pool does not match the trusted deployment");
  }
  if (deployment.chainId !== payload.chainId) {
    throw new Error("Chain does not match the trusted deployment");
  }
  if (deployment.token.address.toLowerCase() !== payload.token.toLowerCase()) {
    throw new Error("Token does not match the trusted deployment");
  }

  return payload;
}

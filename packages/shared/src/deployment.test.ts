import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deploymentSchema,
  loadDeploymentManifest,
} from "../src/deployment.ts";

describe("loadDeploymentManifest", () => {
  it("loads monad testnet manifest", () => {
    const manifest = loadDeploymentManifest();
    assert.equal(manifest.chainId, 10143);
    assert.ok(manifest.pools["1000000"]?.address);
    assert.equal(manifest.token.decimals, 6);
  });

  it("rejects a non-Circle token and incomplete pool map", () => {
    const manifest = loadDeploymentManifest();
    assert.throws(() =>
      deploymentSchema.parse({
        ...manifest,
        token: { ...manifest.token, address: "0x0000000000000000000000000000000000000001" },
      }),
    );
    const { "100000000": _removed, ...incompletePools } = manifest.pools;
    assert.throws(() => deploymentSchema.parse({ ...manifest, pools: incompletePools }));
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  IncrementalMerkleTree,
  noteCommitment,
  noteNullifier,
  poseidonHash,
  recipientBindingHash,
} from "./poseidon.ts";

test("Poseidon matches the pinned circomlib vector", async () => {
  assert.equal(
    await poseidonHash([1n, 2n]),
    7853200120776062878684798364095072458815029376092732009249414926327459813530n
  );
});

test("note hashes match the real-proof fixture", async () => {
  const common = {
    secret: 123456789n,
    recipientKeyDigest: 987654321n,
    chainId: 10143n,
    poolAddress: 0x1111111111111111111111111111111111111111n,
  };

  assert.equal(
    await noteCommitment({ ...common, denomination: 1_000_000n }),
    19704668471148097459842979921476641662514068439076916067817955518290534219087n
  );
  assert.equal(
    await noteNullifier(common),
    15940931592856020578471016406835330995927665848866522502007669593044549568945n
  );
  assert.equal(
    await recipientBindingHash({
      secret: common.secret,
      recipientKeyDigest: common.recipientKeyDigest,
      recipientAddress: 0x2222222222222222222222222222222222222222n,
    }),
    7544252932296718785895030182782020193591259701785332315597165496042527040954n
  );
});

test("tree initialization is idempotent and does not erase inserts", async () => {
  const tree = new IncrementalMerkleTree(20);
  const inserted = await tree.insert(11n);
  await tree.init();
  assert.equal(tree.nextLeafIndex, 1);
  assert.equal(tree.root, inserted.root);
});

test("invalid tree depths are rejected", () => {
  assert.throws(() => new IncrementalMerkleTree(0), /tree depth/);
  assert.throws(() => new IncrementalMerkleTree(31), /tree depth/);
  assert.throws(() => new IncrementalMerkleTree(1.5), /tree depth/);
});

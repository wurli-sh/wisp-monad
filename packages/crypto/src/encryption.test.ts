import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decryptEnvelope,
  encryptEnvelope,
  envelopeHash,
  hexToBytes,
  bytesToHex,
  createRegisteredNoteEnvelope,
  recipientKeyDigest,
  x25519SharedSecret,
} from "@wisp/crypto";
import nacl from "tweetnacl";

describe("encryption envelope", () => {
  it("round-trips", () => {
    const recipient = nacl.box.keyPair();
    const sender = nacl.box.keyPair();
    const plaintext = new TextEncoder().encode('{"v":1}');
    const enc = encryptEnvelope(
      recipient.publicKey,
      sender.secretKey,
      plaintext,
    );
    const opened = decryptEnvelope(
      recipient.secretKey,
      enc.ephemeralPubkey,
      enc.nonce,
      enc.ciphertext,
    );
    assert.deepEqual(opened, plaintext);
    const hash = envelopeHash({
      recipientPubkey: bytesToHex(recipient.publicKey),
      ephemeralPubkey: bytesToHex(enc.ephemeralPubkey),
      nonce: bytesToHex(enc.nonce),
      ciphertext: bytesToHex(enc.ciphertext),
    });
    assert.equal(hash.length, 64);
    assert.equal(hexToBytes("0x0102").length, 2);
  });

  it("creates commitment and ciphertext from the same ephemeral key", async () => {
    const recipient = nacl.box.keyPair();
    const created = await createRegisteredNoteEnvelope({
      recipientPubkey: recipient.publicKey,
      secret: 123n,
      denomination: 1_000_000n,
      chainId: 10_143n,
      poolAddress: 0x1111111111111111111111111111111111111111n,
      encodePayload: ({ commitment }) =>
        new TextEncoder().encode(JSON.stringify({ commitment: commitment.toString() })),
    });
    const shared = x25519SharedSecret(recipient.secretKey, created.ephemeralPubkey);
    assert.equal(recipientKeyDigest(shared), created.recipientKeyDigest);
    const opened = decryptEnvelope(
      recipient.secretKey,
      created.ephemeralPubkey,
      created.nonce,
      created.ciphertext,
    );
    assert.match(new TextDecoder().decode(opened), new RegExp(created.commitment.toString()));
  });

  it("rejects invalid hex and an all-zero X25519 peer", () => {
    assert.throws(() => hexToBytes("0x123"), /invalid hex/);
    assert.throws(
      () => x25519SharedSecret(nacl.randomBytes(32), new Uint8Array(32)),
      /invalid X25519/,
    );
  });
});

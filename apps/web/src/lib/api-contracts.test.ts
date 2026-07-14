import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeActivityResponse,
  normalizeInvitesResponse,
  normalizeMeResponse,
  normalizeNotesResponse,
} from "./api-contracts.ts";

describe("Phase 2 API response normalization", () => {
  it("maps database-shaped account fields for the UI", () => {
    const me = normalizeMeResponse({
      userId: "user-1",
      handles: [
        {
          id: "handle-1",
          provider: "x",
          normalized: "wisp",
          display: "@wisp",
          verified_at: "2026-07-14T00:00:00.000Z",
        },
      ],
      wallet: {
        address: `0x${"11".repeat(20)}`,
        chain_id: 10143,
        inbox_pubkey: `0x${"22".repeat(32)}`,
      },
    });

    assert.equal(me.wallet?.chainId, 10143);
    assert.equal(me.wallet?.inboxPubkey, `0x${"22".repeat(32)}`);
    assert.equal(me.handles[0]?.verifiedAt, "2026-07-14T00:00:00.000Z");
  });

  it("unwraps and maps encrypted notes", () => {
    const notes = normalizeNotesResponse({
      notes: [
        {
          id: "note-1",
          recipient_pubkey: `0x${"11".repeat(32)}`,
          ephemeral_pubkey: `0x${"22".repeat(32)}`,
          nonce: `0x${"33".repeat(24)}`,
          ciphertext: "0xaabb",
          created_at: "2026-07-14T00:00:00.000Z",
          claimed_at: null,
        },
      ],
    });

    assert.equal(notes[0]?.ephemeralPubkey, `0x${"22".repeat(32)}`);
    assert.equal(notes[0]?.claimedAt, null);
  });

  it("unwraps and maps sent invites", () => {
    const invites = normalizeInvitesResponse({
      invites: [
        {
          id: "invite-1",
          normalized_handle: "person@example.com",
          delivery_kind: "email",
          created_at: "2026-07-14T00:00:00.000Z",
          delivered_at: null,
          claimed_at: null,
        },
      ],
    });

    assert.equal(invites[0]?.normalizedHandle, "person@example.com");
    assert.equal(invites[0]?.deliveryKind, "email");
  });

  it("unwraps and maps encrypted activity", () => {
    const activity = normalizeActivityResponse({
      activity: [
        {
          id: "activity-1",
          ephemeral_pubkey: `0x${"44".repeat(32)}`,
          nonce: `0x${"55".repeat(24)}`,
          ciphertext: "0xaabb",
          created_at: "2026-07-14T00:00:00.000Z",
        },
      ],
    });

    assert.equal(activity[0]?.ephemeralPubkey, `0x${"44".repeat(32)}`);
  });
});

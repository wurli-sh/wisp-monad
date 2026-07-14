export type ApiHandle = {
  id: string;
  provider: string;
  normalized: string;
  display: string;
  verified_at?: string;
};

export type ApiWallet = {
  address: string;
  chain_id: number;
  inbox_pubkey: string;
  linked_at?: string;
};

export type ApiMeResponse = {
  userId: string;
  handles: ApiHandle[];
  wallet: ApiWallet | null;
};

export type MeResponse = {
  userId: string;
  handles: Array<{
    id: string;
    provider: string;
    normalized: string;
    display: string;
    verifiedAt?: string;
  }>;
  wallet: {
    address: string;
    chainId: number;
    inboxPubkey: string;
    linkedAt?: string;
  } | null;
};

export function normalizeMeResponse(response: ApiMeResponse): MeResponse {
  return {
    userId: response.userId,
    handles: response.handles.map((handle) => ({
      id: handle.id,
      provider: handle.provider,
      normalized: handle.normalized,
      display: handle.display,
      ...(handle.verified_at ? { verifiedAt: handle.verified_at } : {}),
    })),
    wallet: response.wallet
      ? {
          address: response.wallet.address,
          chainId: response.wallet.chain_id,
          inboxPubkey: response.wallet.inbox_pubkey,
          ...(response.wallet.linked_at
            ? { linkedAt: response.wallet.linked_at }
            : {}),
        }
      : null,
  };
}

export type ApiNoteRow = {
  id: string;
  recipient_pubkey: string;
  ephemeral_pubkey: string;
  nonce: string;
  ciphertext: string;
  created_at: string;
  claimed_at: string | null;
};

export type NoteRow = {
  id: string;
  recipientPubkey: string;
  ephemeralPubkey: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
  claimedAt: string | null;
};

export function normalizeNotesResponse(response: {
  notes: ApiNoteRow[];
}): NoteRow[] {
  return response.notes.map((note) => ({
    id: note.id,
    recipientPubkey: note.recipient_pubkey,
    ephemeralPubkey: note.ephemeral_pubkey,
    nonce: note.nonce,
    ciphertext: note.ciphertext,
    createdAt: note.created_at,
    claimedAt: note.claimed_at,
  }));
}

export type ApiInviteRow = {
  id: string;
  normalized_handle: string;
  delivery_kind: string;
  created_at: string;
  delivered_at: string | null;
  claimed_at: string | null;
};

export type InviteRow = {
  id: string;
  normalizedHandle: string;
  deliveryKind: string;
  createdAt: string;
  deliveredAt: string | null;
  claimedAt: string | null;
};

export function normalizeInvitesResponse(response: {
  invites: ApiInviteRow[];
}): InviteRow[] {
  return response.invites.map((invite) => ({
    id: invite.id,
    normalizedHandle: invite.normalized_handle,
    deliveryKind: invite.delivery_kind,
    createdAt: invite.created_at,
    deliveredAt: invite.delivered_at,
    claimedAt: invite.claimed_at,
  }));
}

export type ApiActivityRow = {
  id: string;
  ephemeral_pubkey: string;
  nonce: string;
  ciphertext: string;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  ephemeralPubkey: string;
  nonce: string;
  ciphertext: string;
  createdAt: string;
};

export function normalizeActivityResponse(response: {
  activity: ApiActivityRow[];
}): ActivityRow[] {
  return response.activity.map((activity) => ({
    id: activity.id,
    ephemeralPubkey: activity.ephemeral_pubkey,
    nonce: activity.nonce,
    ciphertext: activity.ciphertext,
    createdAt: activity.created_at,
  }));
}

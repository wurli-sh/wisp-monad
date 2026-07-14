pragma circom 2.1.6;

// Wisp claim circuit — Groth16 / BN254 (bn128).
// Public signals (LOCKED order):
//   root, nullifier, recipientAddress, denomination, chainId, poolAddress, recipientBinding
// Domain tags: NOTE_V1=1, NULLIFIER_V1=2, RECIPIENT_V1=3

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template Claim(DEPTH) {
    // Public
    signal input root;
    signal input nullifier;
    signal input recipientAddress;
    signal input denomination;
    signal input chainId;
    signal input poolAddress;
    signal input recipientBinding;

    // Private
    signal input secret;
    signal input recipientKeyDigest;
    signal input pathElements[DEPTH];
    signal input pathIndices[DEPTH];

    // --- denomination ∈ {1e6, 10e6, 50e6, 100e6} ---
    component eq1 = IsEqual();
    eq1.in[0] <== denomination;
    eq1.in[1] <== 1000000;
    component eq10 = IsEqual();
    eq10.in[0] <== denomination;
    eq10.in[1] <== 10000000;
    component eq50 = IsEqual();
    eq50.in[0] <== denomination;
    eq50.in[1] <== 50000000;
    component eq100 = IsEqual();
    eq100.in[0] <== denomination;
    eq100.in[1] <== 100000000;
    eq1.out + eq10.out + eq50.out + eq100.out === 1;

    // --- recipientAddress != 0 ---
    component recipNonZero = IsZero();
    recipNonZero.in <== recipientAddress;
    recipNonZero.out === 0;

    // --- leaf = Poseidon(NOTE_V1, secret, recipientKeyDigest, denomination, chainId, poolAddress) ---
    component leafHasher = Poseidon(6);
    leafHasher.inputs[0] <== 1; // NOTE_V1
    leafHasher.inputs[1] <== secret;
    leafHasher.inputs[2] <== recipientKeyDigest;
    leafHasher.inputs[3] <== denomination;
    leafHasher.inputs[4] <== chainId;
    leafHasher.inputs[5] <== poolAddress;

    // --- nullifier = Poseidon(NULLIFIER_V1, secret, recipientKeyDigest, chainId, poolAddress) ---
    component nullifierHasher = Poseidon(5);
    nullifierHasher.inputs[0] <== 2; // NULLIFIER_V1
    nullifierHasher.inputs[1] <== secret;
    nullifierHasher.inputs[2] <== recipientKeyDigest;
    nullifierHasher.inputs[3] <== chainId;
    nullifierHasher.inputs[4] <== poolAddress;
    nullifierHasher.out === nullifier;

    // --- recipientBinding = Poseidon(RECIPIENT_V1, secret, recipientKeyDigest, recipientAddress) ---
    component bindingHasher = Poseidon(4);
    bindingHasher.inputs[0] <== 3; // RECIPIENT_V1
    bindingHasher.inputs[1] <== secret;
    bindingHasher.inputs[2] <== recipientKeyDigest;
    bindingHasher.inputs[3] <== recipientAddress;
    bindingHasher.out === recipientBinding;

    // --- Merkle membership ---
    component levelHashers[DEPTH];
    signal levelHashes[DEPTH + 1];
    signal left[DEPTH];
    signal right[DEPTH];

    levelHashes[0] <== leafHasher.out;

    for (var i = 0; i < DEPTH; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        left[i] <== (pathElements[i] - levelHashes[i]) * pathIndices[i] + levelHashes[i];
        right[i] <== (levelHashes[i] - pathElements[i]) * pathIndices[i] + pathElements[i];
        levelHashers[i] = Poseidon(2);
        levelHashers[i].inputs[0] <== left[i];
        levelHashers[i].inputs[1] <== right[i];
        levelHashes[i + 1] <== levelHashers[i].out;
    }

    levelHashes[DEPTH] === root;
}

component main {
    public [
        root,
        nullifier,
        recipientAddress,
        denomination,
        chainId,
        poolAddress,
        recipientBinding
    ]
} = Claim(20);

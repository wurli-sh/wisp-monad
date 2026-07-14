pragma circom 2.1.6;

// Tiny BN254 viability circuit for Phase 1A gas/precompile gate.
// Proves knowledge of `preimage` such that Poseidon(preimage) == hash.
include "../node_modules/circomlib/circuits/poseidon.circom";

template Viability() {
    signal input hash;
    signal input preimage;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== preimage;
    hash === hasher.out;
}

component main {public [hash]} = Viability();

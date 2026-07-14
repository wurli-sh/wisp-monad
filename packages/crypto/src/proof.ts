/** snarkjs Groth16 proof shape (decimal string coords). */
export type SnarkjsGroth16Proof = {
  pi_a: [string, string, ...string[]];
  pi_b: [[string, string], [string, string], ...unknown[]];
  pi_c: [string, string, ...string[]];
};

export type SolidityGroth16Proof = {
  a: [`0x${string}`, `0x${string}`];
  b: [[`0x${string}`, `0x${string}`], [`0x${string}`, `0x${string}`]];
  c: [`0x${string}`, `0x${string}`];
};

function hex32(value: string | bigint): `0x${string}` {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Convert snarkjs groth16 proof to Solidity verifier argument order.
 * Matches Foundry fixtures / snarkjs exportSolidityCallData G2 limb swap.
 */
export function proofToSolidityCalldata(
  proof: SnarkjsGroth16Proof,
): SolidityGroth16Proof {
  return {
    a: [hex32(proof.pi_a[0]!), hex32(proof.pi_a[1]!)],
    b: [
      [hex32(proof.pi_b[0]![1]!), hex32(proof.pi_b[0]![0]!)],
      [hex32(proof.pi_b[1]![1]!), hex32(proof.pi_b[1]![0]!)],
    ],
    c: [hex32(proof.pi_c[0]!), hex32(proof.pi_c[1]!)],
  };
}

export function publicSignalsToHex(
  publicSignals: ReadonlyArray<string>,
): `0x${string}`[] {
  return publicSignals.map((s) => hex32(s));
}

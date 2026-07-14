export type MerklePathResponse = {
  root: `0x${string}`;
  leafIndex: number;
  pathElements: `0x${string}`[];
  pathIndices: number[];
  blockNumber: number;
};

import { SNARK_SCALAR_FIELD } from "@wisp/shared";

type PoseidonApi = { hash: (inputs: bigint[]) => bigint };

let poseidonPromise: Promise<PoseidonApi> | null = null;

async function getPoseidon(): Promise<PoseidonApi> {
  if (!poseidonPromise) {
    poseidonPromise = (async () => {
      const { buildPoseidon } = await import("circomlibjs");
      const poseidon = await buildPoseidon();
      const F = poseidon.F;
      return {
        hash(inputs: bigint[]): bigint {
          for (const v of inputs) {
            if (v < 0n || v >= SNARK_SCALAR_FIELD) {
              throw new Error("poseidon input out of field");
            }
          }
          return F.toObject(poseidon(inputs)) as bigint;
        },
      };
    })();
  }
  return poseidonPromise;
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const p = await getPoseidon();
  return p.hash(inputs);
}

export async function computeZeroHashes(depth: number): Promise<bigint[]> {
  const zeros: bigint[] = [];
  let current = 0n;
  for (let i = 0; i < depth; i++) {
    zeros.push(current);
    current = await poseidonHash([current, current]);
  }
  return zeros;
}

export async function emptyRoot(depth: number): Promise<bigint> {
  let cur = 0n;
  for (let i = 0; i < depth; i++) {
    cur = await poseidonHash([cur, cur]);
  }
  return cur;
}

/** Sparse incremental Poseidon Merkle tree matching Circom left/right ordering. */
export class IncrementalMerkleTree {
  readonly depth: number;
  private nextIndex = 0;
  private filled: bigint[] = [];
  private zeros: bigint[] = [];
  private _root = 0n;
  private ready = false;

  constructor(depth: number) {
    if (!Number.isInteger(depth) || depth <= 0 || depth > 30) {
      throw new Error("tree depth must be an integer between 1 and 30");
    }
    this.depth = depth;
  }

  async init(): Promise<void> {
    if (this.ready) return;
    this.zeros = await computeZeroHashes(this.depth);
    this.filled = this.zeros.slice();
    this._root = await emptyRoot(this.depth);
    this.ready = true;
  }

  get nextLeafIndex(): number {
    return this.nextIndex;
  }

  get root(): bigint {
    if (!this.ready) throw new Error("tree not initialized");
    return this._root;
  }

  async insert(leaf: bigint): Promise<{
    leafIndex: number;
    root: bigint;
    pathElements: bigint[];
    pathIndices: number[];
  }> {
    if (!this.ready) await this.init();
    const capacity = 1 << this.depth;
    if (this.nextIndex >= capacity) throw new Error("tree full");

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let currentIndex = this.nextIndex;
    let currentHash = leaf;

    for (let level = 0; level < this.depth; level++) {
      if (currentIndex % 2 === 0) {
        pathIndices.push(0);
        pathElements.push(this.zeros[level]!);
        this.filled[level] = currentHash;
        currentHash = await poseidonHash([currentHash, this.zeros[level]!]);
      } else {
        pathIndices.push(1);
        pathElements.push(this.filled[level]!);
        currentHash = await poseidonHash([this.filled[level]!, currentHash]);
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    this._root = currentHash;
    const leafIndex = this.nextIndex;
    this.nextIndex += 1;
    return { leafIndex, root: currentHash, pathElements, pathIndices };
  }

  /** Rebuild the current tree and return a path for any existing leaf. */
  async pathForLeafIndex(
    leafIndex: number,
    leavesInOrder: bigint[],
  ): Promise<{
    root: bigint;
    pathElements: bigint[];
    pathIndices: number[];
  }> {
    if (leafIndex < 0 || leafIndex >= leavesInOrder.length) {
      throw new Error("leaf index out of range");
    }
    const capacity = 1 << this.depth;
    if (leavesInOrder.length > capacity) throw new Error("tree full");
    for (const leaf of leavesInOrder) {
      if (leaf < 0n || leaf >= SNARK_SCALAR_FIELD) {
        throw new Error("leaf out of field");
      }
    }

    const zeros = await computeZeroHashes(this.depth);
    let levelNodes = new Map<number, bigint>(
      leavesInOrder.map((leaf, index) => [index, leaf]),
    );
    let targetIndex = leafIndex;
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];

    for (let level = 0; level < this.depth; level++) {
      const siblingIndex = targetIndex ^ 1;
      pathElements.push(levelNodes.get(siblingIndex) ?? zeros[level]!);
      pathIndices.push(targetIndex & 1);

      const parentIndices = new Set<number>();
      for (const index of levelNodes.keys()) parentIndices.add(Math.floor(index / 2));
      const next = new Map<number, bigint>();
      for (const parent of parentIndices) {
        const left = levelNodes.get(parent * 2) ?? zeros[level]!;
        const right = levelNodes.get(parent * 2 + 1) ?? zeros[level]!;
        next.set(parent, await poseidonHash([left, right]));
      }
      levelNodes = next;
      targetIndex = Math.floor(targetIndex / 2);
    }

    return {
      root: levelNodes.get(0) ?? (await emptyRoot(this.depth)),
      pathElements,
      pathIndices,
    };
  }
}

export async function noteCommitment(params: {
  secret: bigint;
  recipientKeyDigest: bigint;
  denomination: bigint;
  chainId: bigint;
  poolAddress: bigint;
}): Promise<bigint> {
  return poseidonHash([
    1n,
    params.secret,
    params.recipientKeyDigest,
    params.denomination,
    params.chainId,
    params.poolAddress,
  ]);
}

export async function noteNullifier(params: {
  secret: bigint;
  recipientKeyDigest: bigint;
  chainId: bigint;
  poolAddress: bigint;
}): Promise<bigint> {
  return poseidonHash([
    2n,
    params.secret,
    params.recipientKeyDigest,
    params.chainId,
    params.poolAddress,
  ]);
}

export async function recipientBindingHash(params: {
  secret: bigint;
  recipientKeyDigest: bigint;
  recipientAddress: bigint;
}): Promise<bigint> {
  return poseidonHash([
    3n,
    params.secret,
    params.recipientKeyDigest,
    params.recipientAddress,
  ]);
}

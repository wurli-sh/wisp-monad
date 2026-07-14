declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    F: { toObject: (value: unknown) => bigint | number };
    (inputs: bigint[]): unknown;
  }>;
}

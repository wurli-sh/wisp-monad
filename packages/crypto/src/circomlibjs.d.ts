declare module "circomlibjs" {
  export type PoseidonField = {
    toObject(value: unknown): bigint;
  };

  export type Poseidon = {
    (inputs: readonly bigint[]): unknown;
    F: PoseidonField;
  };

  export function buildPoseidon(): Promise<Poseidon>;
}

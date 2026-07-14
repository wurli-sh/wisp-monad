import { createHmac } from "node:crypto";

export function computeNullifierTag(
  keysJson: string | undefined,
  nullifier: string,
): string | null {
  const entries = parseKeyRing(keysJson);
  const current = entries.at(-1);
  if (!current) return null;
  const [, key] = current;
  if (!key) return null;
  return createHmac("sha256", key).update(nullifier).digest("hex");
}

export function computeNullifierTags(
  keysJson: string | undefined,
  nullifier: string,
): string[] {
  return parseKeyRing(keysJson).map(([, key]) =>
    createHmac("sha256", key).update(nullifier).digest("hex"),
  );
}

function parseKeyRing(keysJson: string | undefined): Array<[number, string]> {
  if (!keysJson) return [];
  const parsed = JSON.parse(keysJson) as Record<string, unknown>;
  return Object.entries(parsed)
    .map(([version, key]) => [Number(version), key] as const)
    .filter((entry): entry is readonly [number, string] =>
      Number.isInteger(entry[0]) && entry[0] >= 0 && typeof entry[1] === "string" && entry[1].length > 0
    )
    .sort((a, b) => a[0] - b[0])
    .map(([version, key]) => [version, key]);
}

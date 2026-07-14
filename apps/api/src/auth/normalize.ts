export type HandleProvider = "google" | "x" | "email";

export function normalizeHandle(
  provider: HandleProvider,
  raw: string,
): { normalized: string; display: string } {
  if (provider === "email") {
    const trimmed = raw.trim();
    if (trimmed.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("invalid email");
    }
    const display = trimmed;
    const normalized = trimmed.toLowerCase();
    return { normalized, display };
  }
  let handle = raw.trim();
  if (handle.startsWith("@")) handle = handle.slice(1);
  handle = handle.normalize("NFKC");
  const normalized = handle.toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) {
    throw new Error("invalid X handle");
  }
  const display = `@${normalized}`;
  return { normalized, display };
}

export function parseResolveQuery(q: string): {
  provider: "x" | "email";
  normalized: string;
} {
  const trimmed = q.trim();
  if (trimmed.includes("@") && trimmed.includes(".")) {
    const norm = normalizeHandle("email", trimmed);
    return { provider: "email", normalized: norm.normalized };
  }
  if (trimmed.includes("@")) {
    const norm = normalizeHandle("x", trimmed);
    return { provider: "x", normalized: norm.normalized };
  }
  if (trimmed.includes(".")) {
    const norm = normalizeHandle("email", trimmed);
    return { provider: "email", normalized: norm.normalized };
  }
  const norm = normalizeHandle("x", trimmed);
  return { provider: "x", normalized: norm.normalized };
}

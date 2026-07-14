import {
  proofToSolidityCalldata,
  type SolidityGroth16Proof,
} from "@wisp/crypto/proof";

export type ProveProgress =
  | "loading"
  | "witness"
  | "proving"
  | "done"
  | "error"
  | "cancelled";

export type ProveResult = {
  proof: SolidityGroth16Proof;
  publicSignals: string[];
};

async function sha256HexOfUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const buf = await res.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function loadExpectedArtifactHashes(): Promise<{
  wasm: string;
  zkey: string;
}> {
  const res = await fetch("/circuits/artifacts-manifest.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("Failed to load circuit artifacts-manifest.json");
  const json = (await res.json()) as {
    artifacts?: { wasm?: string; zkey?: string };
  };
  if (!json.artifacts?.wasm || !json.artifacts?.zkey) {
    throw new Error("Circuit artifacts-manifest missing wasm/zkey hashes");
  }
  return { wasm: json.artifacts.wasm, zkey: json.artifacts.zkey };
}

export async function verifyCircuitArtifacts(expected?: {
  wasm: string;
  zkey: string;
}): Promise<void> {
  const declared = await loadExpectedArtifactHashes();
  if (
    expected &&
    (declared.wasm !== expected.wasm || declared.zkey !== expected.zkey)
  ) {
    throw new Error("Circuit manifest does not match the deployment manifest");
  }
  const want = expected ?? declared;
  const [wasmHash, zkeyHash] = await Promise.all([
    sha256HexOfUrl("/circuits/claim.wasm"),
    sha256HexOfUrl("/circuits/claim_final.zkey"),
  ]);
  if (wasmHash !== want.wasm || zkeyHash !== want.zkey) {
    throw new Error("Circuit artifact checksum mismatch");
  }
}

export function proveInWorker(
  input: Record<string, string | string[]>,
  onProgress?: (stage: ProveProgress) => void,
): { promise: Promise<ProveResult>; cancel: () => void } {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL("./worker.ts", import.meta.url));
  let settled = false;
  let rejectPromise: ((reason?: unknown) => void) | null = null;

  const terminate = () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };

  const promise = new Promise<ProveResult>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (ev: MessageEvent) => {
      const data = ev.data as {
        type: string;
        id: string;
        stage?: string;
        proof?: Parameters<typeof proofToSolidityCalldata>[0];
        publicSignals?: string[];
        message?: string;
      };
      if (data.id !== id) return;
      if (data.type === "progress") {
        onProgress?.(data.stage === "witness" ? "witness" : "proving");
        return;
      }
      if (data.type === "error") {
        settled = true;
        terminate();
        reject(new Error(data.message ?? "Prove failed"));
        return;
      }
      if (data.type === "done" && data.proof && data.publicSignals) {
        settled = true;
        terminate();
        onProgress?.("done");
        resolve({
          proof: proofToSolidityCalldata(data.proof),
          publicSignals: data.publicSignals,
        });
      }
    };
    worker.onerror = (e) => {
      settled = true;
      terminate();
      reject(e.error ?? new Error("Worker error"));
    };
    onProgress?.("loading");
    worker.postMessage({
      type: "prove",
      id,
      input,
      wasmUrl: `${globalThis.location.origin}/circuits/claim.wasm`,
      zkeyUrl: `${globalThis.location.origin}/circuits/claim_final.zkey`,
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      terminate();
      onProgress?.("cancelled");
      rejectPromise?.(new DOMException("Proof cancelled", "AbortError"));
    },
  };
}

/// <reference lib="webworker" />

type ProveRequest = {
  type: "prove";
  id: string;
  input: Record<string, string | string[]>;
  wasmUrl: string;
  zkeyUrl: string;
};

type CancelRequest = { type: "cancel"; id: string };

let currentId: string | null = null;

self.onmessage = async (ev: MessageEvent<ProveRequest | CancelRequest>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    if (currentId === msg.id) currentId = null;
    return;
  }
  currentId = msg.id;
  try {
    // snarkjs is heavy — load only in the worker
    const snarkjs = await import("snarkjs");
    if (currentId !== msg.id) return;
    self.postMessage({ type: "progress", id: msg.id, stage: "witness" });
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      msg.input,
      msg.wasmUrl,
      msg.zkeyUrl,
    );
    if (currentId !== msg.id) return;
    self.postMessage({
      type: "done",
      id: msg.id,
      proof,
      publicSignals,
    });
  } catch (err) {
    if (currentId !== msg.id) return;
    self.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : "Prove failed",
    });
  } finally {
    if (currentId === msg.id) currentId = null;
  }
};

export {};

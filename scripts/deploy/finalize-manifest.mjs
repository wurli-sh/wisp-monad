import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.WISP_DEPLOYMENT_ROOT
  ? path.resolve(process.env.WISP_DEPLOYMENT_ROOT)
  : path.resolve(here, "../..");
const pendingPath = path.join(root, "deployments/10143.pending.json");
const finalPath = path.join(root, "deployments/10143.json");
const broadcastPath = path.join(
  root,
  "contracts/broadcast/Deploy.s.sol/10143/run-latest.json"
);
const circuitManifestPath = path.join(
  root,
  "circuits/artifacts/claim/artifacts-manifest.json"
);

if (fs.existsSync(finalPath)) throw new Error("deployments/10143.json already exists");
for (const required of [pendingPath, broadcastPath, circuitManifestPath]) {
  if (!fs.existsSync(required)) throw new Error(`missing deployment input: ${required}`);
}

const pending = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
const broadcast = JSON.parse(fs.readFileSync(broadcastPath, "utf8"));
const circuit = JSON.parse(fs.readFileSync(circuitManifestPath, "utf8"));
const circleUsdc = "0x534b2f3A21130d7a60830c2Df862319e593943A3";

if (Number(pending.chainId) !== 10143) throw new Error("pending manifest has wrong chain ID");
if (pending.token.toLowerCase() !== circleUsdc.toLowerCase()) {
  throw new Error("pending manifest has wrong token");
}

const contracts = {
  verifier: pending.verifier,
  poseidon: pending.poseidon,
  pool1: pending.pool1,
  pool10: pending.pool10,
  pool50: pending.pool50,
  pool100: pending.pool100,
};
const addresses = Object.values(contracts).map((value) => value.toLowerCase());
if (new Set(addresses).size !== addresses.length || addresses.some((value) => /^0x0+$/.test(value))) {
  throw new Error("deployment addresses are zero or duplicated");
}

function deploymentRecord(address) {
  const transaction = broadcast.transactions.find(
    (entry) => entry.contractAddress?.toLowerCase() === address.toLowerCase()
  );
  if (!transaction?.hash) throw new Error(`missing creation transaction for ${address}`);
  const receipt = broadcast.receipts.find(
    (entry) => entry.transactionHash?.toLowerCase() === transaction.hash.toLowerCase()
  );
  if (!receipt?.blockNumber) throw new Error(`missing receipt for ${address}`);
  return {
    transactionHash: transaction.hash,
    blockNumber: Number(BigInt(receipt.blockNumber)),
  };
}

const records = Object.fromEntries(
  Object.entries(contracts).map(([name, address]) => [name, deploymentRecord(address)])
);
const explorer = "https://testnet.monadvision.com";
const withExplorer = (name, address) => ({
  address,
  explorerUrl: `${explorer}/address/${address}`,
  ...records[name],
});

const manifest = {
  version: 1,
  chainId: 10143,
  network: "Monad Testnet",
  generatedAt: new Date().toISOString(),
  deploymentBlock: Math.min(...Object.values(records).map((record) => record.blockNumber)),
  admin: pending.admin,
  token: {
    issuer: "Circle",
    symbol: "USDC",
    decimals: 6,
    address: circleUsdc,
    explorerUrl: `${explorer}/address/${circleUsdc}`,
  },
  circuitId: "0xb615da4b4eb2693502e7da531e51e7450572c8c2083105ef2f5898b38ad38745",
  verifier: withExplorer("verifier", contracts.verifier),
  poseidon: withExplorer("poseidon", contracts.poseidon),
  pools: {
    "1000000": withExplorer("pool1", contracts.pool1),
    "10000000": withExplorer("pool10", contracts.pool10),
    "50000000": withExplorer("pool50", contracts.pool50),
    "100000000": withExplorer("pool100", contracts.pool100),
  },
  circuitArtifacts: circuit.artifacts,
};

fs.writeFileSync(finalPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
fs.unlinkSync(pendingPath);
console.log(`wrote ${finalPath}`);

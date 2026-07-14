import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isDev = process.env.NODE_ENV === "development";

const scriptSrc = [
  "'self'",
  "'wasm-unsafe-eval'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");

const connectSrc = [
  "'self'",
  "https:",
  "wss:",
  ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
].join(" ");

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  poweredByHeader: false,
  transpilePackages: ["@wisp/crypto", "@wisp/shared"],
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@wisp/crypto$": path.join(root, "packages/crypto/src/index.ts"),
      "@wisp/crypto/encryption$": path.join(
        root,
        "packages/crypto/src/encryption.ts",
      ),
      "@wisp/crypto/poseidon$": path.join(root, "packages/crypto/src/poseidon.ts"),
      "@wisp/crypto/proof$": path.join(root, "packages/crypto/src/proof.ts"),
      "@wisp/crypto/signature$": path.join(
        root,
        "packages/crypto/src/signature.ts",
      ),
      "@wisp/shared$": path.join(root, "packages/shared/src/index.ts"),
    };
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".ts": [".ts", ".tsx"],
    };
    return config;
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        { key: "Referrer-Policy", value: "no-referrer" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            `script-src ${scriptSrc}`,
            "worker-src 'self' blob:",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            `connect-src ${connectSrc}`,
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;

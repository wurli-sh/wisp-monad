import { pino, type DestinationStream, type Logger } from "pino";
import type { AppConfig } from "./config.ts";

export function createLogger(
  config: AppConfig,
  destination?: DestinationStream,
): Logger {
  const base = {
    level: config.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.url",
        "req.body.signature",
        "req.body.inboxSignature",
        "req.body.ciphertext",
        "req.body.recipientEmail",
        "req.body.claimPayload",
        "signature",
        "ciphertext",
        "email",
        "claimUrl",
        "claimParams",
        "url",
      ],
      censor: "[REDACTED]",
    },
  };

  if (config.nodeEnv === "development") {
    return pino({
      ...base,
      transport: { target: "pino-pretty", options: { colorize: true } },
    });
  }

  return pino(base, destination);
}

export type { Logger };

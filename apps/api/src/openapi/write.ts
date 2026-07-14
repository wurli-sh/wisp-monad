import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getOpenApiDocument } from "./document.ts";

const output = fileURLToPath(new URL("../../openapi.json", import.meta.url));
await writeFile(output, `${JSON.stringify(getOpenApiDocument(), null, 2)}\n`, "utf8");

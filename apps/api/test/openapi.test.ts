import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOpenApiDocument } from "../src/openapi/document.ts";

describe("OpenAPI document", () => {
  it("covers every Phase 2 route and derives strict write schemas from Zod", () => {
    const document = getOpenApiDocument();
    assert.equal(document.openapi, "3.1.0");
    assert.ok(document.paths["/v1/wallet/link"]);
    assert.ok(document.paths["/v1/merkle/path"]);
    assert.ok(document.paths["/v1/admin/reindex"]);
    const envelope = document.paths["/v1/notes"].post.requestBody.content["application/json"].schema;
    assert.equal(envelope.additionalProperties, false);
  });
});

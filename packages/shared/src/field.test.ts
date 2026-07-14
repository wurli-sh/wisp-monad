import assert from "node:assert/strict";
import test from "node:test";

import { SNARK_SCALAR_FIELD } from "./constants.ts";
import { assertCanonicalField, fieldToHex, hexToField } from "./field.ts";

test("canonical field boundaries round trip", () => {
  assert.equal(hexToField(fieldToHex(0n)), 0n);
  assert.equal(hexToField(fieldToHex(SNARK_SCALAR_FIELD - 1n)), SNARK_SCALAR_FIELD - 1n);
});

test("non-canonical field values are rejected", () => {
  assert.throws(() => assertCanonicalField(-1n), /canonical field range/);
  assert.throws(() => assertCanonicalField(SNARK_SCALAR_FIELD), /canonical field range/);
});

test("field hex must be exactly 32 bytes", () => {
  assert.throws(() => hexToField("0x01"), /32-byte hex/);
  assert.throws(() => hexToField(`0x${"gg".repeat(32)}`), /32-byte hex/);
});

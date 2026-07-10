import test from "node:test";
import assert from "node:assert/strict";
import { searchScore } from "../src/search.js";

const baseEntry = {
  code: "780",
  message: "Operation timed out",
  product: "Laserfiche Server/Repository Server",
  summary: "The server did not respond.",
  symptoms: [],
  likelyFixes: [],
  versions: ["Version 12"],
  sources: [],
};

test("numeric searches do not fuzzy-match unrelated digits", () => {
  const unrelated = {
    ...baseEntry,
    code: "1203",
    summary: "Version 9 through Version 12 connectivity guidance.",
  };
  assert.equal(searchScore(unrelated, "9030"), 0);
});

test("exact and partial error-code searches remain strongly ranked", () => {
  assert.ok(searchScore({ ...baseEntry, code: "9030" }, "9030") >= 1000);
  assert.ok(searchScore({ ...baseEntry, code: "0x8009030e" }, "9030") >= 650);
});

test("word typo tolerance remains available", () => {
  assert.ok(searchScore(baseEntry, "opertion") > 0);
});

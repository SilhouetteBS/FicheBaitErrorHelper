import test from "node:test";
import assert from "node:assert/strict";
import { validateSourceUrl } from "../src/data/sourcePolicy.js";

test("source policy accepts only the expected HTTPS host for each source type", () => {
  assert.equal(validateSourceUrl("official-docs", "https://doc.laserfiche.com/topic").valid, true);
  assert.equal(validateSourceUrl("support-knowledge-base", "https://support.laserfiche.com/kb/1").valid, true);
  assert.equal(validateSourceUrl("answers-community", "https://answers.laserfiche.com/questions/1").valid, true);
  assert.equal(validateSourceUrl("official-docs", "http://doc.laserfiche.com/topic").valid, false);
  assert.equal(validateSourceUrl("official-docs", "https://example.com/topic").valid, false);
  assert.equal(validateSourceUrl("answers-search", "https://answers.laserfiche.com/questions?q=test&token=secret").valid, false);
  assert.equal(validateSourceUrl("unknown", "https://doc.laserfiche.com/topic").valid, false);
});

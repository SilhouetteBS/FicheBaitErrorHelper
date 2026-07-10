import test from "node:test";
import assert from "node:assert/strict";
import { errorEntries } from "../src/data/errors.js";
import { officialDocumentationErrorEntries } from "../src/data/officialDocumentationErrors.js";
import { reviewedSources } from "../src/data/reviewedSources.js";
import { catalogIndex } from "../src/data/generated/catalogIndex.js";
import { productLoaders } from "../src/data/generated/catalogManifest.js";
import { reviewedSources as generatedReviewedSources } from "../src/data/generated/reviewedSources.js";

test("catalog and ledger identifiers are unique", () => {
  assert.equal(new Set(errorEntries.map((entry) => entry.id)).size, errorEntries.length);
  assert.equal(new Set(reviewedSources.map((source) => source.id)).size, reviewedSources.length);
  assert.equal(new Set(reviewedSources.map((source) => source.url)).size, reviewedSources.length);
});

test("every official product and code remains represented", () => {
  const published = new Set(errorEntries.map((entry) => `${entry.product}\u0000${entry.code}`));
  for (const entry of officialDocumentationErrorEntries) {
    assert.ok(published.has(`${entry.product}\u0000${entry.code}`), `${entry.product} ${entry.code}`);
  }
});

test("entry and ledger source classifications agree", () => {
  const ledgerByUrl = new Map(reviewedSources.map((source) => [source.url, source]));
  for (const entry of errorEntries) {
    for (const source of entry.sources) {
      assert.equal(ledgerByUrl.get(source.url)?.sourceType, source.sourceType, `${entry.id}: ${source.url}`);
    }
  }
});

test("generated runtime catalog remains in parity with curated data", async () => {
  assert.deepEqual(
    catalogIndex.map((entry) => entry.id).sort(),
    errorEntries.map((entry) => entry.id).sort(),
  );
  assert.deepEqual(
    generatedReviewedSources.map((source) => source.url).sort(),
    reviewedSources.map((source) => source.url).sort(),
  );
  const productEntries = (await Promise.all(Object.values(productLoaders).map((loader) => loader())))
    .flatMap((module) => module.productEntries);
  assert.deepEqual(
    productEntries.map((entry) => entry.id).sort(),
    errorEntries.map((entry) => entry.id).sort(),
  );
});

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

test("duplicate error contexts are merged without breaking legacy links", () => {
  const formsLff706Entries = errorEntries.filter((entry) => entry.product === "Forms" && entry.code === "LFF706");
  assert.equal(formsLff706Entries.length, 1);
  const [entry] = formsLff706Entries;
  assert.equal(entry.id, "forms-lff706-unable-to-trigger-routing");
  assert.ok(entry.aliases.includes("forms-lff706-routing-endpoint"));
  assert.equal(entry.scenarios.length, 3);
  assert.equal(entry.sources.length, 3);
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

test("Laserfiche Installer contains installer failures rather than errors owned by other products", () => {
  const workflowExample = errorEntries.find(
    (entry) =>
      entry.id ===
      "laserfiche-installer-0588-wf1-issue-publishing-workflows-with-custom-activities-using-3rd-party",
  );
  assert.equal(workflowExample?.product, "Workflow");

  const clientEmailExample = errorEntries.find(
    (entry) =>
      entry.id ===
      "answers-promoted-laserfiche-installer-6000-a-microsoft-software-installer-error-was-encountered-error-6000",
  );
  assert.equal(clientEmailExample?.product, "Windows Client/Desktop Client");
  assert.equal(clientEmailExample?.validationStatus, "reviewed-diagnostic");

  const installerEntries = errorEntries.filter((entry) => entry.product === "Laserfiche Installer");
  for (const entry of installerEntries) {
    assert.doesNotMatch(entry.code, /(?:^|\s)(?:LFF\d|\d{4}-WF\d)/i, entry.id);
  }

  const nonErrorIds = new Set([
    "support-promoted-1000619-laserfiche-installer-installer-list-of-fixes-in-laserfiche-6-11-list-of-fixes-in-laserfiche-6-11",
    "support-promoted-1000988-laserfiche-installer-installer-license-file-locations-license-file-locations",
  ]);
  assert.equal(errorEntries.some((entry) => nonErrorIds.has(entry.id)), false);
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

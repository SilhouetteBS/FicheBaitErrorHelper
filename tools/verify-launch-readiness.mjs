import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { productAliases, productOptions, sourceTypeOptions, versionOptions } from "../src/data/catalogMetadata.js";
import { errorEntries } from "../src/data/errors.js";
import { reviewedSources } from "../src/data/reviewedSources.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "LICENSE",
  "CONTENT-NOTICE.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "README.md",
  "CHANGELOG.md",
  "docs/known-limitations.md",
  "docs/community-workflow.md",
  "docs/maintenance-plan.md",
  "docs/product-aliases.md",
  "docs/data-quality-roadmap.md",
  "docs/launch-announcement.md",
  "tests/catalog.test.mjs",
  "tests/search.test.mjs",
  "research/support-chrome-search-index.md",
  ".github/ISSUE_TEMPLATE/error-report.yml",
  ".github/ISSUE_TEMPLATE/fix-source.yml",
  ".github/ISSUE_TEMPLATE/source-correction.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
];

const errors = [];
const sourceTypeValues = new Set(sourceTypeOptions.map((option) => option.value));
const productValues = new Set(productOptions);
const versionValues = new Set(versionOptions);
const reviewedUrls = new Set(reviewedSources.map((source) => source.url));

for (const file of requiredFiles) {
  if (!existsSync(resolve(rootDir, file))) errors.push(`Missing required community readiness file: ${file}`);
}

for (const entry of errorEntries) {
  if (!productValues.has(entry.product)) errors.push(`${entry.id} uses unknown product ${entry.product}`);
  for (const version of entry.versions) {
    if (!versionValues.has(version)) errors.push(`${entry.id} uses unknown version ${version}`);
  }
  for (const source of entry.sources) {
    if (!sourceTypeValues.has(source.sourceType)) errors.push(`${entry.id} uses unknown source type ${source.sourceType}`);
    if (!reviewedUrls.has(source.url)) errors.push(`${entry.id} source is missing from reviewed ledger: ${source.url}`);
  }
  for (const scenario of entry.scenarios ?? []) {
    for (const url of scenario.sourceUrls ?? []) {
      if (!entry.sources.some((source) => source.url === url)) {
        errors.push(`${entry.id} scenario "${scenario.title}" references a source URL not present on the entry: ${url}`);
      }
    }
  }
}

for (const [product, aliases] of Object.entries(productAliases)) {
  if (!productValues.has(product)) errors.push(`Alias map uses unknown product ${product}`);
  if (!Array.isArray(aliases) || aliases.length === 0) errors.push(`Alias map for ${product} must include at least one alias`);
}

if (!productAliases["Web Client"]?.includes("Web Access")) {
  errors.push("Product aliases must include Web Access -> Web Client.");
}
if (!productAliases["Laserfiche Server/Repository Server"]?.includes("Repository Server")) {
  errors.push("Product aliases must include Repository Server -> Laserfiche Server/Repository Server.");
}
if (!productAliases["Directory Server"]?.includes("LFDS")) {
  errors.push("Product aliases must include LFDS -> Directory Server.");
}

const scenarioEntries = errorEntries.filter((entry) => (entry.scenarios?.length ?? 0) > 0);
const knownFixes = errorEntries.filter((entry) => entry.fixStatus === "known-fix");
const workarounds = errorEntries.filter((entry) => entry.fixStatus === "workaround");

if (scenarioEntries.length < 20) errors.push(`Expected at least 20 entries with scenarios; found ${scenarioEntries.length}.`);
if (knownFixes.length < 100) errors.push(`Expected at least 100 known-fix entries; found ${knownFixes.length}.`);
if (workarounds.length < 300) errors.push(`Expected at least 300 workaround entries; found ${workarounds.length}.`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Launch readiness check passed: ${errorEntries.length} entries, ${reviewedSources.length} reviewed sources, ${scenarioEntries.length} scenario entries.`,
);

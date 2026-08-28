import { errorEntries, productOptions, sourcePriority, versionOptions } from "../src/data/errors.js";
import { officialDocumentationErrorEntries } from "../src/data/officialDocumentationErrors.js";
import { reviewedSources } from "../src/data/reviewedSources.js";
import { validateSourceUrl } from "../src/data/sourcePolicy.js";

const errors = [];
const reviewedByUrl = new Map(reviewedSources.map((source) => [source.url, source]));
const validProducts = new Set(productOptions);
const validVersions = new Set(versionOptions);
const validConfidences = new Set(["low", "medium", "high"]);
const validFixStatuses = new Set(["known-fix", "workaround", "diagnostic-only", "unresolved", "needs-review"]);
const validValidationStatuses = new Set(["official-doc-baseline", "reviewed-diagnostic", "source-research-needed"]);
const sortedProducts = [...productOptions].sort((a, b) => a.localeCompare(b));
const entryIds = new Set();
const entryAliases = new Set();
const ledgerIds = new Set();
const ledgerUrls = new Set();

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

if (productOptions.some((product, index) => product !== sortedProducts[index])) {
  errors.push("productOptions must remain in alphabetical order");
}

for (const entry of errorEntries) {
  if (entryIds.has(entry.id) || entryAliases.has(entry.id)) errors.push(`Duplicate entry id or alias ${entry.id}`);
  entryIds.add(entry.id);
  for (const alias of entry.aliases ?? []) {
    if (!alias || entryIds.has(alias) || entryAliases.has(alias)) {
      errors.push(`${entry.id} uses duplicate or invalid alias ${alias}`);
    }
    entryAliases.add(alias);
  }
  for (const field of ["id", "code", "message", "product", "confidence", "reviewedDate", "summary"]) {
    if (!entry[field]) errors.push(`${entry.id || "unknown"} is missing ${field}`);
  }
  if (!validConfidences.has(entry.confidence)) errors.push(`${entry.id} uses unknown confidence ${entry.confidence}`);
  if (!isIsoDate(entry.reviewedDate)) errors.push(`${entry.id} uses invalid reviewed date ${entry.reviewedDate}`);
  if (!Array.isArray(entry.versions) || entry.versions.length === 0) {
    errors.push(`${entry.id} must include at least one version label`);
  }
  if (!Array.isArray(entry.symptoms) || entry.symptoms.length === 0) errors.push(`${entry.id} must include symptoms`);
  if (!Array.isArray(entry.likelyFixes) || entry.likelyFixes.length === 0) errors.push(`${entry.id} must include likely fixes`);
  if (entry.fixStatus && !validFixStatuses.has(entry.fixStatus)) {
    errors.push(`${entry.id} uses unknown fix status ${entry.fixStatus}`);
  }
  if (entry.validationStatus && !validValidationStatuses.has(entry.validationStatus)) {
    errors.push(`${entry.id} uses unknown validation status ${entry.validationStatus}`);
  }
  if (!validProducts.has(entry.product)) {
    errors.push(`${entry.id} uses unknown product ${entry.product}`);
  }
  for (const version of entry.versions ?? []) {
    if (!validVersions.has(version)) {
      errors.push(`${entry.id} uses unknown version ${version}`);
    }
  }
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
    errors.push(`${entry.id} must include source evidence`);
  }
  for (const source of entry.sources ?? []) {
    if (!sourcePriority[source.sourceType]) {
      errors.push(`${entry.id} uses unknown source type ${source.sourceType}`);
    }
    if (!source.title) errors.push(`${entry.id} has a source without a title`);
    const sourceUrlValidation = validateSourceUrl(source.sourceType, source.url);
    if (!sourceUrlValidation.valid) errors.push(`${entry.id} has an invalid source URL ${source.url}: ${sourceUrlValidation.reason}`);
    const reviewedSource = reviewedByUrl.get(source.url);
    if (!reviewedSource) {
      errors.push(`${entry.id} source ${source.url} is not in the reviewed-source ledger`);
    } else if (reviewedSource.sourceType !== source.sourceType) {
      errors.push(`${entry.id} source type ${source.sourceType} does not match ledger type ${reviewedSource.sourceType} for ${source.url}`);
    }
  }
  for (const [index, scenario] of (entry.scenarios ?? []).entries()) {
    const scenarioLabel = `${entry.id} scenario ${index + 1}`;
    if (!scenario.title) {
      errors.push(`${scenarioLabel} is missing title`);
    }
    if (!Array.isArray(scenario.fixes) || scenario.fixes.length === 0) {
      errors.push(`${scenarioLabel} must include at least one fix or next step`);
    }
    for (const version of scenario.versions ?? []) {
      if (!validVersions.has(version)) {
        errors.push(`${scenarioLabel} uses unknown version ${version}`);
      }
    }
    for (const url of scenario.sourceUrls ?? []) {
      if (!entry.sources.some((source) => source.url === url)) {
        errors.push(`${scenarioLabel} source ${url} is not listed on the parent entry`);
      }
    }
  }
}

for (const source of reviewedSources) {
  if (ledgerIds.has(source.id)) errors.push(`Duplicate reviewed-source id ${source.id}`);
  if (ledgerUrls.has(source.url)) errors.push(`Duplicate reviewed-source URL ${source.url}`);
  ledgerIds.add(source.id);
  ledgerUrls.add(source.url);
  for (const field of ["id", "title", "url", "sourceType", "reviewedDate", "reviewStatus"]) {
    if (!source[field]) errors.push(`${source.id || "unknown reviewed source"} is missing ${field}`);
  }
  if (!sourcePriority[source.sourceType]) errors.push(`${source.id} uses unknown source type ${source.sourceType}`);
  const sourceUrlValidation = validateSourceUrl(source.sourceType, source.url);
  if (!sourceUrlValidation.valid) errors.push(`${source.id} has invalid URL ${source.url}: ${sourceUrlValidation.reason}`);
  if (!isIsoDate(source.reviewedDate)) errors.push(`${source.id} uses invalid reviewed date ${source.reviewedDate}`);
  if (!Array.isArray(source.productTags)) errors.push(`${source.id} must include productTags`);
  if (!Array.isArray(source.extractedErrorCodes)) errors.push(`${source.id} must include extractedErrorCodes`);
}

const publishedProductCodes = new Set(errorEntries.map((entry) => `${entry.product}\u0000${entry.code}`));
for (const officialEntry of officialDocumentationErrorEntries) {
  const key = `${officialEntry.product}\u0000${officialEntry.code}`;
  if (!publishedProductCodes.has(key)) {
    errors.push(`Official entry ${officialEntry.id} has no published ${officialEntry.product} / ${officialEntry.code} baseline`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${errorEntries.length} error entries and ${reviewedSources.length} reviewed sources.`);

import fs from "node:fs";

import { errorEntries, productOptions } from "../src/data/errors.js";
import { reviewedSources } from "../src/data/reviewedSources.js";

const reportDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function fixStatusValue(entry) {
  if (entry.fixStatus) return entry.fixStatus;
  if (entry.confidence === "low") return "needs-review";
  return "diagnostic-only";
}

function sourcePriority(sourceType) {
  if (sourceType === "official-docs") return 1;
  if (sourceType === "support-knowledge-base") return 2;
  if (sourceType === "answers-laserfiche-employee") return 3;
  if (sourceType === "answers-community-confirmed") return 4;
  if (sourceType === "answers-community") return 5;
  return 6;
}

function countBy(rows, getKey) {
  return rows.reduce((acc, row) => {
    const key = getKey(row) || "Unspecified";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function table(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function sourceLabel(sourceType) {
  const labels = {
    "official-docs": "Official Docs",
    "support-knowledge-base": "Support Knowledge Base",
    "answers-laserfiche-employee": "Answers - Laserfiche Employee",
    "answers-community-confirmed": "Answers - Community Confirmed",
    "answers-community": "Answers - Community",
    "answers-search": "Answers - Search Reviewed",
  };
  return labels[sourceType] ?? sourceType;
}

function reviewScore(entry) {
  const status = fixStatusValue(entry);
  let score = 0;
  if (entry.confidence === "low") score += 100;
  if (status === "needs-review") score += 90;
  if (status === "unresolved") score += 80;
  if (status === "diagnostic-only") score += 65;
  if ((entry.scenarios?.length ?? 0) === 0) score += 20;
  score += Math.min(...entry.sources.map((source) => sourcePriority(source.sourceType))) * -8;
  return score;
}

const needsValidation = errorEntries
  .filter(
    (entry) =>
      !entry.validationStatus &&
      (entry.confidence === "low" || ["diagnostic-only", "unresolved", "needs-review"].includes(fixStatusValue(entry))),
  )
  .sort((a, b) => reviewScore(b) - reviewScore(a) || a.product.localeCompare(b.product) || a.code.localeCompare(b.code, undefined, { numeric: true }));

const byProduct = countBy(needsValidation, (entry) => entry.product);
const byFixStatus = countBy(errorEntries, fixStatusValue);
const byConfidence = countBy(errorEntries, (entry) => entry.confidence);
const byValidationStatus = countBy(errorEntries.filter((entry) => entry.validationStatus), (entry) => entry.validationStatus);
const sourceReviewStatus = countBy(reviewedSources, (source) => source.reviewStatus);
const unresolvedSources = reviewedSources.filter((source) => source.reviewStatus === "curated-unresolved");
const highValueUnresolvedSources = unresolvedSources.filter((source) =>
  ["answers-laserfiche-employee", "answers-community-confirmed"].includes(source.sourceType),
);
const publishedByProduct = countBy(errorEntries, (entry) => entry.product);
const thinCoverageProducts = productOptions
  .map((product) => [product, publishedByProduct[product] || 0])
  .filter(([, count]) => count < 5)
  .sort(([, a], [, b]) => a - b);
const productSplitCandidates = productOptions
  .map((product) => {
    const entries = errorEntries.filter((entry) => entry.product === product);
    const sourceCount = entries.reduce((total, entry) => total + entry.sources.length, 0);
    return [product, entries.length, sourceCount];
  })
  .sort(([, entryCountA, sourceCountA], [, entryCountB, sourceCountB]) => entryCountB - entryCountA || sourceCountB - sourceCountA);
const repeatedCodeClusters = Object.values(
  errorEntries.reduce((groups, entry) => {
    groups[entry.code] ??= [];
    groups[entry.code].push(entry);
    return groups;
  }, {}),
)
  .filter((entries) => entries.length > 1)
  .map((entries) => ({
    code: entries[0].code,
    count: entries.length,
    products: Array.from(new Set(entries.map((entry) => entry.product))).sort(),
    scenarioEntries: entries.filter((entry) => (entry.scenarios?.length ?? 0) > 0).length,
  }))
  .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, undefined, { numeric: true }));

const report = [
  "# FicheBait Error Helper Quality Report",
  "",
  `Generated: ${reportDate}`,
  "",
  "## Summary",
  "",
  `- Published entries: ${errorEntries.length}`,
  `- Reviewed sources: ${reviewedSources.length}`,
  `- Entries needing validation: ${needsValidation.length}`,
  `- Entries with scenario variants: ${errorEntries.filter((entry) => (entry.scenarios?.length ?? 0) > 0).length}`,
  `- High-priority unresolved reviewed sources: ${highValueUnresolvedSources.length}`,
  `- Thin-coverage products with fewer than 5 entries: ${thinCoverageProducts.length}`,
  `- Repeated-code clusters to review for scenario modeling: ${repeatedCodeClusters.length}`,
  "",
  "## Confidence Coverage",
  "",
  table(
    ["Confidence", "Entries"],
    Object.entries(byConfidence).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => [status, count]),
  ),
  "",
  "## Fix Status Coverage",
  "",
  table(
    ["Fix status", "Entries"],
    Object.entries(byFixStatus).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => [status, count]),
  ),
  "",
  "## Validation Triage Coverage",
  "",
  table(
    ["Validation status", "Entries"],
    Object.entries(byValidationStatus).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => [status, count]),
  ),
  "",
  "## Validation Queue by Product",
  "",
  table(
    ["Product", "Needs validation"],
    productOptions.map((product) => [product, byProduct[product] || 0]),
  ),
  "",
  "## Reviewed Source Status",
  "",
  table(
    ["Review status", "Sources"],
    Object.entries(sourceReviewStatus).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => [status, count]),
  ),
  "",
  "## High-Priority Unresolved Sources",
  "",
  table(
    ["Source type", "Sources"],
    Object.entries(countBy(highValueUnresolvedSources, (source) => source.sourceType))
      .sort(([a], [b]) => sourcePriority(a) - sourcePriority(b))
      .map(([sourceType, count]) => [sourceLabel(sourceType), count]),
  ),
  "",
  "## Thin Product Coverage",
  "",
  table(["Product", "Published entries"], thinCoverageProducts.map(([product, count]) => [product, count])),
  "",
  "## Product-Level Lazy Load Candidates",
  "",
  table(
    ["Product", "Published entries", "Linked sources"],
    productSplitCandidates.slice(0, 10).map(([product, entryCount, sourceCount]) => [product, entryCount, sourceCount]),
  ),
  "",
  "## Repeated-Code Scenario Review",
  "",
  table(
    ["Code", "Entries", "Products", "Entries with scenarios"],
    repeatedCodeClusters.slice(0, 25).map((cluster) => [
      cluster.code,
      cluster.count,
      cluster.products.join(", ").replaceAll("|", "\\|"),
      cluster.scenarioEntries,
    ]),
  ),
  "",
  "## Top Validation Candidates",
  "",
  table(
    ["Product", "Code", "Fix status", "Confidence", "Best source", "Title"],
    needsValidation.slice(0, 50).map((entry) => {
      const bestSource = [...entry.sources].sort((a, b) => sourcePriority(a.sourceType) - sourcePriority(b.sourceType))[0];
      return [
        entry.product,
        entry.code,
        fixStatusValue(entry),
        entry.confidence,
        sourceLabel(bestSource?.sourceType),
        entry.message.replaceAll("|", "\\|"),
      ];
    }),
  ),
  "",
  "## Review Rules",
  "",
  "- Prioritize low-confidence entries that have Laserfiche employee or official documentation sources.",
  "- Upgrade an entry only when the source supports the symptom, cause, and fix for the product/version context.",
  "- Add scenario variants when the same code has different causes or fixes.",
  "- Keep unresolved diagnostic entries visible when they help users identify the error but do not imply a confirmed fix.",
  "- Catalog data is already split into Vite chunks for errors, reviewed sources, official docs, and vendor code; keep large new datasets in separate importable modules.",
  "- If product-level lazy loading is implemented later, start with the largest products in the Product-Level Lazy Load Candidates section.",
  "",
];

fs.writeFileSync("research/quality-report.md", `${report.join("\n")}\n`);
console.log(`Wrote research/quality-report.md with ${needsValidation.length} validation candidates.`);

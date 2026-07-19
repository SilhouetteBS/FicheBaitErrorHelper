import fs from "node:fs";

import { errorEntries, productOptions } from "../src/data/errors.js";
import { reviewedSources } from "../src/data/reviewedSources.js";

const discoveryRows = JSON.parse(fs.readFileSync("research/product-discovery-results.json", "utf8"));
const reportDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function countBy(rows, getKey) {
  return rows.reduce((acc, row) => {
    const key = getKey(row) || "Unspecified";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sortEntries(object) {
  return Object.entries(object).sort(([a], [b]) => a.localeCompare(b));
}

function productRows() {
  const publishedByProduct = countBy(errorEntries, (entry) => entry.product);
  const candidatesByProduct = discoveryRows.reduce((acc, row) => {
    if (row.status !== "candidate") return acc;
    acc[row.product] = (acc[row.product] || 0) + 1;
    return acc;
  }, {});

  return productOptions.map((product) => ({
    product,
    published: publishedByProduct[product] || 0,
    remainingCandidates: candidatesByProduct[product] || 0,
  }));
}

function table(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

const sourceStatusCounts = countBy(reviewedSources, (source) => source.reviewStatus);
const discoveryStatusCounts = countBy(discoveryRows, (row) => row.status);
const fixStatusCounts = countBy(errorEntries, (entry) => entry.fixStatus || (entry.confidence === "low" ? "needs-review" : "diagnostic-only"));
const sourceTypeCounts = countBy(reviewedSources, (source) => source.sourceType);
const products = productRows();

const report = [
  "# FicheBait Error Helper Progress Report",
  "",
  `Generated: ${reportDate}`,
  "",
  "## Summary",
  "",
  `- Published helper entries: ${errorEntries.length}`,
  `- Reviewed source ledger rows: ${reviewedSources.length}`,
  `- Discovery rows tracked: ${discoveryRows.length}`,
  `- Remaining candidate rows: ${discoveryStatusCounts.candidate || 0}`,
  "",
  "## Fix Status Coverage",
  "",
  table(["Fix status", "Entries"], sortEntries(fixStatusCounts).map(([status, count]) => [status, count])),
  "",
  "## Source Ledger Review Status",
  "",
  table(["Review status", "Sources"], sortEntries(sourceStatusCounts).map(([status, count]) => [status, count])),
  "",
  "## Reviewed Source Types",
  "",
  table(["Source type", "Sources"], sortEntries(sourceTypeCounts).map(([type, count]) => [type, count])),
  "",
  "## Product Coverage",
  "",
  table(
    ["Product", "Published entries", "Remaining candidates"],
    products.map((row) => [row.product, row.published, row.remainingCandidates]),
  ),
  "",
  "## Next Batch Targets",
  "",
  table(
    ["Product", "Remaining candidates"],
    products
      .filter((row) => row.remainingCandidates > 0)
      .sort((a, b) => b.remainingCandidates - a.remainingCandidates || a.product.localeCompare(b.product))
      .slice(0, 10)
      .map((row) => [row.product, row.remainingCandidates]),
  ),
  "",
];

fs.writeFileSync("research/progress-report.md", `${report.join("\n")}\n`);
console.log(`Wrote research/progress-report.md with ${errorEntries.length} entries and ${reviewedSources.length} reviewed sources.`);

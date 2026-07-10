import fs from "node:fs";
import path from "node:path";
import { errorEntries } from "../src/data/errors.js";
import { reviewedSources } from "../src/data/reviewedSources.js";
import {
  supportChromePromotedErrorEntries,
  supportChromeSourceCurationQueue,
} from "../src/data/supportChromePromotions.js";

const researchDir = "research";
const stateFiles = fs
  .readdirSync(researchDir)
  .filter((name) => /^support-chrome-search-state-\d{4}-\d{2}-\d{2}\.json$/.test(name))
  .sort()
  .map((name) => path.join(researchDir, name));
const indexPath = path.join(researchDir, "support-chrome-search-index.md");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function byCount(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item) || "Unclassified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function table(rows, columns) {
  return [
    `| ${columns.map((column) => column.label).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => markdownCell(column.value(row))).join(" | ")} |`),
  ].join("\n");
}

function markdownCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceUrl(entry) {
  return entry.sources?.[0]?.url ?? "";
}

const needsReview = errorEntries.filter((entry) => entry.fixStatus === "needs-review");
const supportNeedsReview = supportChromePromotedErrorEntries.filter((entry) => entry.fixStatus === "needs-review");
const supportReviewedSources = reviewedSources.filter(
  (source) => source.id?.startsWith("support-promoted-source-") || source.id?.startsWith("support-reference-source-"),
);
const states = stateFiles.map((file) => ({ file, state: readJson(file, {}) }));
const batchRows = states.flatMap(({ file, state }) => (state.batches ?? []).map((batch) => {
  const batchData = readJson(batch.batchPath, { rows: [] });
  const products = byCount(batchData.rows ?? [], (row) => row.productHints?.[0] ?? "Unclassified")
    .slice(0, 4)
    .map(([product, count]) => `${product}: ${count}`)
    .join("; ");
  const queries = [...new Set((batchData.rows ?? []).map((row) => row.query).filter(Boolean))].join(", ");
  return {
    runDate: file.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? "Unknown",
    batch: batch.batchNumber,
    rows: batch.count,
    json: batch.batchPath,
    markdown: batch.mdPath,
    queries,
    products,
  };
}));
const latestCursors = new Map();
const visitedSupportUrls = new Set();
for (const { state } of states) {
  for (const [query, cursor] of Object.entries(state.queryCursors ?? {})) latestCursors.set(query, cursor);
  for (const url of state.visitedUrls ?? []) visitedSupportUrls.add(url);
}
const openCursors = [...latestCursors.entries()]
  .filter(([, cursor]) => !cursor.done)
  .map(([query, cursor]) => ({
    query: query.replace(/^query:/, ""),
    page: cursor.page ?? 1,
  }))
  .sort((a, b) => a.query.localeCompare(b.query));

const needsReviewRows = needsReview
  .map((entry) => ({
    product: entry.product,
    code: entry.code,
    message: entry.message,
    confidence: entry.confidence,
    source: entry.sources?.[0]?.sourceType ?? "",
    url: sourceUrl(entry),
  }))
  .sort((a, b) => a.product.localeCompare(b.product) || a.code.localeCompare(b.code, undefined, { numeric: true }));

const sourceCurationRows = supportChromeSourceCurationQueue
  .map((source) => ({
    product: source.product,
    codes: (source.extractedErrorCodes ?? []).join(", "),
    title: source.title,
    url: source.url,
    note: source.curationNote,
  }))
  .sort((a, b) => a.product.localeCompare(b.product) || a.title.localeCompare(b.title));

const needsReviewReport = [
  "# Needs Review Queue",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Total needs-review entries: ${needsReview.length}`,
  `Support KB needs-review entries: ${supportNeedsReview.length}`,
  "",
  "## By Product",
  "",
  table(
    byCount(needsReview, (entry) => entry.product).map(([product, count]) => ({ product, count })),
    [
      { label: "Product", value: (row) => row.product },
      { label: "Needs Review", value: (row) => row.count },
    ],
  ),
  "",
  "## By Source Type",
  "",
  table(
    byCount(needsReview, (entry) => entry.sources?.[0]?.sourceType).map(([sourceType, count]) => ({ sourceType, count })),
    [
      { label: "Source Type", value: (row) => row.sourceType },
      { label: "Needs Review", value: (row) => row.count },
    ],
  ),
  "",
  "## Entries",
  "",
  table(needsReviewRows, [
    { label: "Product", value: (row) => row.product },
    { label: "Code", value: (row) => row.code },
    { label: "Message", value: (row) => row.message },
    { label: "Confidence", value: (row) => row.confidence },
    { label: "Source", value: (row) => row.source },
    { label: "URL", value: (row) => row.url },
  ]),
  "",
].join("\n");

const supportStatus = [
  "# Support KB Research Status",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Visited Support KB URLs: ${visitedSupportUrls.size}`,
  `Promoted Support KB entries: ${supportChromePromotedErrorEntries.length}`,
  `Support KB reviewed-source rows: ${supportReviewedSources.length}`,
  `Search batches captured: ${batchRows.length}`,
  "",
  "## Open Search Cursors",
  "",
  openCursors.length
    ? table(openCursors, [
        { label: "Query", value: (row) => row.query },
        { label: "Next Page", value: (row) => row.page },
      ])
    : "No open Support KB search cursors remain in the current state file.",
  "",
  "## Support Promotion Distribution",
  "",
  table(
    byCount(supportChromePromotedErrorEntries, (entry) => entry.product).map(([product, count]) => ({ product, count })),
    [
      { label: "Product", value: (row) => row.product },
      { label: "Promoted Entries", value: (row) => row.count },
    ],
  ),
  "",
  "## Reference-Only Sources Needing Curation",
  "",
  sourceCurationRows.length
    ? table(sourceCurationRows, [
        { label: "Product", value: (row) => row.product },
        { label: "Extracted Codes", value: (row) => row.codes },
        { label: "Title", value: (row) => row.title },
        { label: "URL", value: (row) => row.url },
      ])
    : "No Support KB reference-only sources are queued for item-level curation.",
  "",
].join("\n");

const supportBatchIndex = [
  "# Support KB Raw Batch Index",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This index summarizes the raw Support KB search batches so the large JSON captures can be audited without opening each file.",
  "",
  `Total captured batch files: ${batchRows.length}`,
  `Total captured rows: ${batchRows.reduce((sum, row) => sum + row.rows, 0)}`,
  "",
  table(batchRows, [
    { label: "Run Date", value: (row) => row.runDate },
    { label: "Batch", value: (row) => row.batch },
    { label: "Rows", value: (row) => row.rows },
    { label: "Queries", value: (row) => row.queries },
    { label: "Top Product Hints", value: (row) => row.products },
    { label: "JSON", value: (row) => row.json },
    { label: "Markdown", value: (row) => row.markdown },
  ]),
  "",
].join("\n");

const readme = [
  "# Research Workspace",
  "",
  "This folder contains source-review artifacts used to build the public Laserfiche Error Helper catalog.",
  "",
  "## Current Published Totals",
  "",
  `- Error entries: ${errorEntries.length}`,
  `- Reviewed sources: ${reviewedSources.length}`,
  `- Needs-review entries: ${needsReview.length}`,
  `- Support KB promoted entries: ${supportChromePromotedErrorEntries.length}`,
  "",
  "## Key Reports",
  "",
  "- `needs-review-report.md`: public entries that still need manual curation into confirmed fixes, workarounds, or lower-priority diagnostic notes.",
  "- `support-kb-research-status.md`: Support Knowledge Base search progress, open cursors, and reference-only sources that need item-level curation.",
  "- `progress-report.md`: generated catalog coverage summary.",
  "- `quality-report.md`: generated validation queue summary.",
  "",
  "## Raw Support Search Artifacts",
  "",
  "Raw Support KB search captures are retained for traceability. The state file tracks visited KB IDs and open cursors so future searches do not repeat prior work.",
  "",
].join("\n");

fs.writeFileSync(path.join(researchDir, "needs-review-report.md"), needsReviewReport);
fs.writeFileSync(path.join(researchDir, "support-kb-research-status.md"), supportStatus);
fs.writeFileSync(indexPath, supportBatchIndex);
fs.writeFileSync(path.join(researchDir, "README.md"), readme);

console.log(`Wrote ${path.join(researchDir, "needs-review-report.md")}`);
console.log(`Wrote ${path.join(researchDir, "support-kb-research-status.md")}`);
console.log(`Wrote ${indexPath}`);
console.log(`Wrote ${path.join(researchDir, "README.md")}`);
console.log(`Needs review: ${needsReview.length}; Support reference-only curation sources: ${sourceCurationRows.length}.`);

import fs from "node:fs";
import path from "node:path";
import { privateResearchDir } from "./research-paths.mjs";

const queuePath = process.argv[2] ?? latestQueuePath();
const outputPath = "src/data/answersChromePromotions.js";
const allowedVersions = ["Version 9", "Version 10", "Version 11", "Version 12"];
const productOptions = [
  "Administration Hub",
  "AI Service",
  "API Server",
  "Audit Trail",
  "Common Dialog",
  "Connector",
  "Directory Server",
  "Discussions",
  "Distributed Computing Cluster",
  "Federated Search",
  "Forms",
  "Full Text Search",
  "Import Agent",
  "Laserfiche Installer",
  "Laserfiche Server/Repository Server",
  "Mobile",
  "Office Integration",
  "Quick Fields",
  "Records Management",
  "Snapshot",
  "Web Client",
  "WebLink",
  "Webtools Agent",
  "Windows Client/Desktop Client",
  "Workflow",
];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function latestQueuePath() {
  const candidates = fs
    .readdirSync(privateResearchDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /^answers-chrome-promotion-queue-\d{4}-\d{2}-\d{2}\.json$/.test(entry.name),
    )
    .map((entry) => path.join(privateResearchDir, entry.name))
    .sort();
  if (candidates.length === 0) throw new Error("No Answers Chrome promotion queue was found.");
  return candidates.at(-1);
}

function queueDate(path) {
  return path.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceType(row) {
  return row.sourceType.includes("Laserfiche employee") ? "answers-laserfiche-employee" : "answers-search";
}

function primaryCode(row) {
  const code = (row.extractedErrorCodes ?? []).find((item) => !/^wf\d*$/i.test(item));
  if (code) return cleanText(code).slice(0, 80);
  return syntheticCode(row);
}

function syntheticCode(row) {
  const productPrefix = {
    "Audit Trail": "AUDIT",
    Connector: "CONNECTOR",
    "Directory Server": "LFDS",
    Forms: "FORMS",
    "Import Agent": "IMPORT",
    "Laserfiche Installer": "INSTALLER",
    "Laserfiche Server/Repository Server": "LFSERVER",
    Mobile: "MOBILE",
    "Quick Fields": "QF",
    Snapshot: "SNAPSHOT",
    "Web Client": "WEBCLIENT",
    WebLink: "WEBLINK",
    Workflow: "WORKFLOW",
  };
  const product = inferProduct(row);
  const prefix = productPrefix[product] ?? "ANSWERS";
  const token = slugify(row.signature || row.title)
    .toUpperCase()
    .replace(/-/g, "_")
    .slice(0, 34);
  return `${prefix}-${token}`.slice(0, 46);
}

function inferProduct(row) {
  const haystack = `${row.title} ${row.signature} ${(row.extractedErrorCodes ?? []).join(" ")} ${row.snippet}`.toLowerCase();
  if (/\blfds\d+\b/.test(haystack) || haystack.includes("directory server")) return "Directory Server";
  if (/\blff\d+/.test(haystack) || haystack.includes("forms")) return "Forms";
  if (/\b\d{3,4}-wf\d+\b/.test(haystack) || haystack.includes("workflow")) return "Workflow";
  if (haystack.includes("weblink") || haystack.includes("web link")) return "WebLink";
  if (haystack.includes("web client") || haystack.includes("web access") || haystack.includes("web scanning")) return "Web Client";
  if (haystack.includes("quick fields") || haystack.includes("qf ")) return "Quick Fields";
  if (haystack.includes("audit trail")) return "Audit Trail";
  if (haystack.includes("import agent")) return "Import Agent";
  if (haystack.includes("snapshot")) return "Snapshot";
  if (haystack.includes("connector")) return "Connector";
  if (haystack.includes("mobile")) return "Mobile";
  if (haystack.includes("installer") || haystack.includes(" msi") || haystack.includes("installation")) return "Laserfiche Installer";
  return productOptions.includes(row.product) ? row.product : "Laserfiche Server/Repository Server";
}

function inferVersions(row) {
  const text = `${row.title} ${row.snippet} ${(row.productTags ?? []).join(" ")}`.toLowerCase();
  const versions = [];
  for (const version of [9, 10, 11, 12]) {
    const hasVersionWord = new RegExp(`\\bversion\\s*${version}\\b`).test(text);
    const hasDecimalVersion = new RegExp(`\\b${version}\\.\\d+`).test(text);
    const hasTag = (row.productTags ?? []).includes(`Version ${version}`);
    if (hasVersionWord || hasDecimalVersion || hasTag) versions.push(`Version ${version}`);
  }
  return versions.length > 0 ? unique(versions) : allowedVersions;
}

function message(row, code) {
  const title = cleanText(row.title);
  return title.slice(0, 160) || `Answers thread mentioning ${code}`;
}

function likelyCause(row) {
  if (row.extractedErrorCodes?.length) {
    return "The linked Answers thread reports this code in a real troubleshooting context, but the exact root cause still needs final curation.";
  }
  return "The linked Answers thread reports this message or symptom in a real troubleshooting context, but the exact root cause still needs final curation.";
}

function sourceNote(row) {
  if (sourceType(row) === "answers-laserfiche-employee") {
    return "Recovered Answers candidate with apparent Laserfiche employee participation; promoted as a needs-review diagnostic entry until the exact fix is curated.";
  }
  return "Recovered Answers candidate promoted as a needs-review diagnostic entry; review the thread before treating it as a confirmed fix.";
}

const queue = readJson(queuePath).promotionQueue;
const defaultReviewedDate = queueDate(queuePath);
const byUrl = new Map(queue.map((row) => [row.url, row]));
const promotedRows = [...byUrl.values()].sort((a, b) => inferProduct(a).localeCompare(inferProduct(b)) || primaryCode(a).localeCompare(primaryCode(b)));

const entries = promotedRows.map((row) => {
  const product = inferProduct(row);
  const code = primaryCode(row);
  const id = `answers-promoted-${slugify(product)}-${slugify(code)}-${slugify(row.title)}`;
  const sourceId = `answers-promoted-source-${slugify(row.title)}`;
  const entryMessage = message(row, code);
  const versions = inferVersions(row);
  const employee = sourceType(row) === "answers-laserfiche-employee";
  const reviewedDate = row.reviewedDate ?? defaultReviewedDate;

  return {
    id,
    code,
    message: entryMessage,
    product,
    versions,
    confidence: employee ? "medium" : "low",
    fixStatus: "needs-review",
    reviewedDate,
    summary: `An Answers thread reports ${entryMessage} for ${product}. This entry is published so users can discover the source while a confirmed fix is still being curated.`,
    symptoms: [
      `The linked Answers thread reports: ${entryMessage}.`,
      row.extractedErrorCodes?.length ? `Reported code or token: ${(row.extractedErrorCodes ?? []).join(", ")}.` : "No stable numeric error code was extracted from the thread.",
    ],
    likelyCauses: [likelyCause(row)],
    likelyFixes: [
      "Open the linked Answers source and compare the reported symptoms, product version, and environment details to the affected system.",
      "Treat this as diagnostic guidance until the thread is manually curated into a confirmed fix or workaround.",
      "If the symptoms match and the source does not provide a clear resolution, collect product logs around the failure time and escalate through normal Laserfiche support channels.",
    ],
    validationStatus: "reviewed-diagnostic",
    notes:
      versions.length === allowedVersions.length
        ? "No version-specific scope was confirmed in the recovered search result; versions 9-12 are included because the issue may plausibly apply to supported self-hosted deployments."
        : "Version scope is based on version text found in the recovered Answers search result.",
    sources: [
      {
        sourceType: sourceType(row),
        title: row.title,
        url: row.url,
        note: sourceNote(row),
      },
    ],
    sourceId,
  };
});

const reviewedSources = entries.map((entry) => ({
  id: entry.sourceId,
  title: entry.sources[0].title,
  url: entry.sources[0].url,
  sourceType: entry.sources[0].sourceType,
  reviewedDate: entry.reviewedDate,
  productTags: unique([entry.product, ...entry.versions]),
  extractedErrorCodes: entry.code ? [entry.code] : [],
  reviewStatus: "curated-unresolved",
}));

const publicEntries = entries.map(({ sourceId, ...entry }) => entry);

const output = [
  `// Generated from ${queuePath.replaceAll("\\", "/")}.`,
  "// These entries are intentionally diagnostic-only/needs-review until each source is manually curated into a confirmed fix.",
  `export const answersChromePromotedErrorEntries = ${JSON.stringify(publicEntries, null, 2)};`,
  "",
  `export const answersChromePromotedReviewedSources = ${JSON.stringify(reviewedSources, null, 2)};`,
  "",
].join("\n");

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${publicEntries.length} promoted Answers entries and ${reviewedSources.length} reviewed sources to ${outputPath}.`);

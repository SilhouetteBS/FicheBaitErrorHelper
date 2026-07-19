import fs from "node:fs";
import path from "node:path";
import { privateResearchDir } from "./research-paths.mjs";

const researchDir = privateResearchDir;
const outputPath = "src/data/supportChromePromotions.js";
const reviewedSourcesPath = "src/data/reviewedSources.js";
const batchPattern = /^support-chrome-search-batch-(\d{4}-\d{2}-\d{2})-\d+\.json$/;

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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return String(value ?? "");
  }
}

function existingSupportUrls() {
  if (!fs.existsSync(reviewedSourcesPath)) return new Set();
  const text = fs.readFileSync(reviewedSourcesPath, "utf8");
  return new Set(
    [...text.matchAll(/https:\/\/support\.laserfiche\.com\/kb\/\d+\/[^"\s]+/g)].map((match) =>
      normalizeUrl(match[0]),
    ),
  );
}

function title(row) {
  const detailTitle = cleanText(row.detailTitle);
  const searchTitle = cleanText(row.title);
  if (detailTitle && !/^-?\s*knowledge base$/i.test(detailTitle)) return detailTitle;
  if (searchTitle && !/^-?\s*knowledge base$/i.test(searchTitle)) return searchTitle;
  const slug = String(row.url ?? "").match(/\/kb\/\d+\/([^/?#]+)/)?.[1];
  if (slug) {
    return slug
      .split("-")
      .filter(Boolean)
      .map((word) => (word.length <= 3 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`))
      .join(" ");
  }
  return `Support KB ${row.kbId}`;
}

function haystack(row) {
  return cleanText(`${row.detailTitle} ${row.title} ${row.snippet} ${row.detailText}`);
}

function inferProduct(row) {
  const detailText = cleanText(row.detailText);
  const productLine = detailText.match(/\bProduct:\s*([^:]+?)\s+KB:/i)?.[1];
  const normalizedProduct =
    productLine && productLine.length < 80 && !/\b(product support|product downloads|privacy|trademark)\b/i.test(productLine)
      ? normalizeProduct(productLine)
      : null;
  if (normalizedProduct) return normalizedProduct;
  if ((row.productHints ?? []).length === 1 && productOptions.includes(row.productHints[0])) return row.productHints[0];
  const text = `${title(row)} ${row.snippet ?? ""}`.toLowerCase();
  if (text.includes("directory server") || /\blfds\b/.test(text)) return "Directory Server";
  if (text.includes("quick fields")) return "Quick Fields";
  if (text.includes("import agent")) return "Import Agent";
  if (text.includes("audit trail")) return "Audit Trail";
  if (text.includes("office integration")) return "Office Integration";
  if (text.includes("api server")) return "API Server";
  if (text.includes("webtools")) return "Webtools Agent";
  if (text.includes("weblink") || text.includes("web link")) return "WebLink";
  if (text.includes("web client") || text.includes("web access") || text.includes("web scanning")) return "Web Client";
  if (text.includes("workflow")) return "Workflow";
  if (text.includes("forms")) return "Forms";
  if (text.includes("connector")) return "Connector";
  if (text.includes("snapshot")) return "Snapshot";
  if (text.includes("mobile") || text.includes("laserfiche app")) return "Mobile";
  if (text.includes("installer") || text.includes("installation") || text.includes(".msi")) return "Laserfiche Installer";
  if (text.includes("full text")) return "Full Text Search";
  return "Laserfiche Server/Repository Server";
}

function normalizeProduct(value) {
  const product = cleanText(value).toLowerCase();
  if (!product) return null;
  if (product.includes("directory server")) return "Directory Server";
  if (product.includes("quick fields")) return "Quick Fields";
  if (product.includes("import agent")) return "Import Agent";
  if (product.includes("audit trail")) return "Audit Trail";
  if (product.includes("office integration")) return "Office Integration";
  if (product.includes("api server")) return "API Server";
  if (product.includes("webtools")) return "Webtools Agent";
  if (product.includes("weblink")) return "WebLink";
  if (product.includes("web client") || product.includes("web access")) return "Web Client";
  if (product.includes("workflow")) return "Workflow";
  if (product.includes("forms")) return "Forms";
  if (product.includes("connector")) return "Connector";
  if (product.includes("snapshot")) return "Snapshot";
  if (product.includes("mobile") || product.includes("laserfiche app")) return "Mobile";
  if (product.includes("installer")) return "Laserfiche Installer";
  if (product.includes("laserfiche")) return "Laserfiche Server/Repository Server";
  return productOptions.find((option) => option.toLowerCase() === product) ?? null;
}

function inferVersions(row) {
  const text = haystack(row).toLowerCase();
  const versions = [];
  for (const version of [9, 10, 11, 12]) {
    const patterns = [
      new RegExp(`\\bversion\\s*${version}\\b`),
      new RegExp(`\\blaserfiche\\s+${version}(?:\\b|\\.)`),
      new RegExp(`\\b(?:forms|workflow|weblink|connector|snapshot|client|server|directory server|quick fields|import agent)\\s+${version}(?:\\b|\\.)`),
      new RegExp(`\\b${version}\\.\\d+`),
    ];
    if (patterns.some((pattern) => pattern.test(text))) versions.push(`Version ${version}`);
  }
  return versions.length > 0 ? unique(versions) : allowedVersions;
}

function meaningfulCodes(row) {
  const text = haystack(row);
  const candidates = new Set();
  for (const value of row.extractedErrorCodes ?? []) {
    const cleaned = cleanText(value);
    if (/^0x[0-9a-f]{8}$/i.test(cleaned) || /^(?:LFF|LFDS|LFSO|LFAH|QF|HTTP|AADSTS)/i.test(cleaned)) {
      candidates.add(cleaned);
    }
  }
  for (const match of text.matchAll(/\b0x[0-9a-fA-F]{8}\b/g)) candidates.add(match[0]);
  for (const match of text.matchAll(/\b(?:LFF|LFDS|LFSO|LFAH|QF|HTTP|AADSTS)[- ]?\d{2,6}(?:[- ][A-Z][A-Z0-9]+)?\b/g)) {
    candidates.add(match[0].replace(/\s+/g, ""));
  }
  for (const match of text.matchAll(/\b(?:error|code|hresult|exception)\D{0,25}(\d{3,6})\b/gi)) {
    candidates.add(match[1]);
  }
  for (const match of text.matchAll(/\[(\d{3,6})\]/g)) candidates.add(match[1]);

  return [...candidates]
    .map((value) => value.replace(/\s+/g, "").replace(/^-+|-+$/g, ""))
    .filter((value) => {
      if (!value || value.length > 48) return false;
      if (/^20(1\d|2\d)$/i.test(value)) return false;
      if (/^20\d{2}/i.test(value)) return false;
      if (/^101\d{4}$/.test(value)) return false;
      if (["9222", "9322"].includes(value)) return false;
      if (/^\d{1,2}$/.test(value)) return false;
      return /\d/.test(value);
    })
    .slice(0, 8);
}

function syntheticCode(row, product) {
  const prefixes = {
    "Administration Hub": "ADMINHUB",
    "AI Service": "AI",
    "API Server": "API",
    "Audit Trail": "AUDIT",
    Connector: "CONNECTOR",
    "Directory Server": "LFDS",
    Forms: "FORMS",
    "Full Text Search": "FTS",
    "Import Agent": "IMPORT",
    "Laserfiche Installer": "INSTALLER",
    "Laserfiche Server/Repository Server": "LFSERVER",
    Mobile: "MOBILE",
    "Office Integration": "OFFICE",
    "Quick Fields": "QF",
    Snapshot: "SNAPSHOT",
    "Web Client": "WEBCLIENT",
    WebLink: "WEBLINK",
    "Webtools Agent": "WEBTOOLS",
    "Windows Client/Desktop Client": "CLIENT",
    Workflow: "WORKFLOW",
  };
  const token = slugify(title(row)).toUpperCase().replace(/-/g, "_").slice(0, 34);
  return `${prefixes[product] ?? "SUPPORT"}-${token}`.slice(0, 48);
}

function productPrefix(product) {
  return (
    {
      "Administration Hub": "ADMINHUB",
      "AI Service": "AI",
      "API Server": "API",
      "Audit Trail": "AUDIT",
      Connector: "CONNECTOR",
      "Directory Server": "LFDS",
      Forms: "FORMS",
      "Full Text Search": "FTS",
      "Import Agent": "IMPORT",
      "Laserfiche Installer": "INSTALLER",
      "Laserfiche Server/Repository Server": "LFSERVER",
      Mobile: "MOBILE",
      "Office Integration": "OFFICE",
      "Quick Fields": "QF",
      Snapshot: "SNAPSHOT",
      "Web Client": "WEBCLIENT",
      WebLink: "WEBLINK",
      "Webtools Agent": "WEBTOOLS",
      "Windows Client/Desktop Client": "CLIENT",
      Workflow: "WORKFLOW",
    }[product] ?? "SUPPORT"
  );
}

function entryMessage(row) {
  return title(row).slice(0, 180);
}

function isReferenceOnlyRow(row) {
  return /^(release notes|list of change(?:s)?|software versions and fixes)\b/i.test(title(row));
}

function likelyFixes(row) {
  const text = row.detailText ?? "";
  const hasResolution = /\b(resolution|workaround|solution)\b/i.test(text);
  return [
    "Open the linked Support Knowledge Base article and compare the article's product, version, symptoms, and environment details to the affected system.",
    hasResolution
      ? "Review the article's Resolution or Workaround section before making changes; validate the change in a test environment or maintenance window."
      : "Treat this as a diagnostic source until a specific fix is manually curated from the article.",
    "If the article does not fully match the environment, collect the relevant Laserfiche product logs around the failure time and escalate through normal Laserfiche support channels.",
  ];
}

function buildEntry(row) {
  const product = inferProduct(row);
  const codes = meaningfulCodes(row);
  const code = codes[0] || syntheticCode(row, product);
  const versions = inferVersions(row);
  const message = entryMessage(row);
  const sourceId = `support-promoted-source-${row.kbId || slugify(message)}`;
  const id = `support-promoted-${row.kbId || slugify(message)}-${slugify(product)}-${slugify(code)}-${slugify(message)}`;
  return {
    id,
    code,
    message,
    product,
    versions,
    confidence: "medium",
    fixStatus: "needs-review",
    reviewedDate: row.reviewedDate,
    summary: `A Laserfiche Support Knowledge Base article reports ${message} for ${product}. This entry is published so users can discover the source while the exact remediation is still being curated.`,
    symptoms: [
      `The linked Support KB article reports: ${message}.`,
      codes.length > 0
        ? `Reported code or token: ${codes.join(", ")}.`
        : "No stable numeric error code was extracted from the article title or summary.",
    ],
    likelyCauses: [
      "The linked Support Knowledge Base article describes this failure in a real troubleshooting context, but the root cause still needs final curation.",
    ],
    likelyFixes: likelyFixes(row),
    validationStatus: "reviewed-diagnostic",
    notes:
      versions.length === allowedVersions.length
        ? "No version-specific scope was confirmed in the Support KB capture; versions 9-12 are included because the issue may plausibly apply to self-hosted deployments."
        : "Version scope is based on version text found in the Support KB article title or body.",
    sources: [
      {
        sourceType: "support-knowledge-base",
        title: message,
        url: row.url,
        note: "Support KB candidate promoted as a needs-review diagnostic entry; review the article before treating it as a confirmed fix.",
      },
    ],
    sourceId,
    sourceCodes: codes.length > 0 ? codes : [code],
  };
}

function buildReferenceSource(row) {
  const product = inferProduct(row);
  const versions = inferVersions(row);
  const message = entryMessage(row);
  const codes = meaningfulCodes({ ...row, detailText: "", snippet: "" });
  const fallbackCode = row.kbId ? `${productPrefix(product)}-KB-${row.kbId}` : syntheticCode(row, product);

  return {
    id: `support-reference-source-${row.kbId || slugify(message)}`,
    title: message,
    url: row.url,
    sourceType: "support-knowledge-base",
    reviewedDate: row.reviewedDate,
    productTags: unique([product, ...versions]),
    extractedErrorCodes: codes.length > 0 ? codes : [fallbackCode],
    reviewStatus: "curated-unresolved",
    product,
    versions,
    sourceCodes: codes.length > 0 ? codes : [fallbackCode],
    curationNote:
      "Reference-only Support KB article. Do not list as a user-facing error until a specific error, symptom, fixed issue, or workaround is extracted.",
  };
}

const existingUrls = existingSupportUrls();
const rowsByUrl = new Map();
for (const file of fs.readdirSync(researchDir).filter((name) => batchPattern.test(name)).sort()) {
  const batch = readJson(path.join(researchDir, file));
  for (const row of batch.rows ?? []) {
    const url = normalizeUrl(row.url);
    if (!url || existingUrls.has(url) || rowsByUrl.has(url)) continue;
    const fileDate = file.match(batchPattern)?.[1];
    rowsByUrl.set(url, { ...row, url, reviewedDate: row.reviewedDate ?? batch.reviewedDate ?? fileDate });
  }
}

const rows = [...rowsByUrl.values()];
const referenceRows = rows.filter(isReferenceOnlyRow);
const entryRows = rows.filter((row) => !isReferenceOnlyRow(row));

const entries = entryRows
  .map(buildEntry)
  .sort((a, b) => a.product.localeCompare(b.product) || a.code.localeCompare(b.code, undefined, { numeric: true }));

const referenceSources = referenceRows
  .map(buildReferenceSource)
  .sort((a, b) => a.product.localeCompare(b.product) || a.title.localeCompare(b.title));

const reviewedSources = [
  ...entries.map((entry) => ({
    id: entry.sourceId,
    title: entry.sources[0].title,
    url: entry.sources[0].url,
    sourceType: "support-knowledge-base",
    reviewedDate: entry.reviewedDate,
    productTags: unique([entry.product, ...entry.versions]),
    extractedErrorCodes: entry.sourceCodes,
    reviewStatus: "curated-unresolved",
  })),
  ...referenceSources.map(({ product, versions, sourceCodes, curationNote, ...source }) => source),
];

const publicEntries = entries.map(({ sourceId, sourceCodes, ...entry }) => entry);
const sourceCurationQueue = referenceSources.map((source) => ({
  id: source.id,
  title: source.title,
  url: source.url,
  product: source.product,
  versions: source.versions,
  extractedErrorCodes: source.sourceCodes,
  curationNote: source.curationNote,
}));

const output = [
  "// Generated from research/support-chrome-search-batch-*.json.",
  "// Public entries exclude broad Support KB release-note/list-of-changes articles; those remain in the reviewed-source ledger and curation queue.",
  `export const supportChromePromotedErrorEntries = ${JSON.stringify(publicEntries, null, 2)};`,
  "",
  `export const supportChromePromotedReviewedSources = ${JSON.stringify(reviewedSources, null, 2)};`,
  "",
  `export const supportChromeSourceCurationQueue = ${JSON.stringify(sourceCurationQueue, null, 2)};`,
  "",
].join("\n");

fs.writeFileSync(outputPath, output);
console.log(
  `Wrote ${publicEntries.length} Support KB entries, ${reviewedSources.length} reviewed sources, and ${sourceCurationQueue.length} reference-only curation rows to ${outputPath}.`,
);

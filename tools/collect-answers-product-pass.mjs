import fs from "node:fs";
import path from "node:path";
import { reviewedSources } from "../src/data/reviewedSources.js";
import { privateResearchPath } from "./research-paths.mjs";

const today = new Date().toISOString().slice(0, 10);
const resultsPath = privateResearchPath("product-discovery-results.json");
const [, , productArg = "", targetArg = "25"] = process.argv;
const requestedProduct = productArg.trim();
const isAllProducts = !requestedProduct || requestedProduct.toLowerCase() === "all";
const targetCount = Number.parseInt(targetArg, 10) || 25;
const passSlug = isAllProducts ? `all-${targetCount}` : `${slugify(requestedProduct)}-${targetCount}`;
const passPath = nextAvailablePassPath(privateResearchPath(`answers-product-pass-${today}-${passSlug}.json`));

const maxPagesPerQuery = targetCount > 25 ? 16 : 8;
const requestTimeoutMs = 15000;
const productSearches = [
  {
    product: "Administration Hub",
    productTags: ["Administration Hub"],
    queries: [
      '"Administration Hub" error Laserfiche',
      '"LFAH" error Laserfiche',
      '"Laserfiche Administration Hub" "error"',
      '"Administration Hub" "Directory Server"',
      '"Administration Hub" "cannot connect"',
    ],
  },
  {
    product: "AI Service",
    productTags: ["AI Service"],
    queries: [
      '"AI Service" error Laserfiche',
      '"Laserfiche AI Service" error',
      '"AI Service" "cannot connect" Laserfiche',
      '"AI Service" "configuration" Laserfiche',
      '"AI Service" "event log" Laserfiche',
    ],
  },
  {
    product: "API Server",
    productTags: ["API Server"],
    queries: [
      '"API Server" error Laserfiche',
      '"Laserfiche API" "self-hosted" error',
      '"LFRepositoryAPI" error',
      '"repositoryAPI" error Laserfiche',
      '"Laserfiche API" "token" error',
      '"Laserfiche API" "HTTP" error',
      '"Laserfiche API" "Access Denied"',
    ],
  },
  {
    product: "Audit Trail",
    productTags: ["Audit Trail"],
    queries: [
      '"Audit Trail" error Laserfiche',
      '"Laserfiche Audit Trail" "error"',
      '"Audit Trail" "cannot connect" Laserfiche',
      '"Audit Trail" "SQL" error',
      '"Audit Trail" "event log" Laserfiche',
    ],
  },
  {
    product: "Common Dialog",
    productTags: ["Common Dialog"],
    queries: [
      '"Common Dialog" error Laserfiche',
      '"Common Dialog Errors" Laserfiche',
      '"2500" "Common Dialog" Laserfiche',
      '"2599" "Common Dialog" Laserfiche',
      '"CommonDialog" error Laserfiche',
    ],
  },
  {
    product: "Connector",
    productTags: ["Connector"],
    queries: [
      '"Connector" error Laserfiche',
      '"Laserfiche Connector" "error"',
      '"Connector" "capture profile" Laserfiche',
      '"Connector" "token" error Laserfiche',
      '"Connector" "cannot connect" Laserfiche',
    ],
  },
  {
    product: "Directory Server",
    productTags: ["Directory Server"],
    queries: [
      '"Directory Server" error Laserfiche',
      '"LFDS" error Laserfiche',
      '"Laserfiche Directory Server" "error"',
      '"LFDS" "SAML" error',
      '"LFDS" "LDAP" error',
      '"Directory Server" "identity provider" error',
      '"LFDS" "LicenseManager" error',
      '"LFDS" "Access Denied"',
      '"LFDS" "Windows Authentication"',
      '"Laserfiche Directory Server" "cannot connect"',
      '"LFDS" "identity provider" "error"',
      '"LFDS" "sync" "error"',
      '"Laserfiche Directory Server" "SAML"',
      '"LFDS" "SQL" "error"',
    ],
  },
  {
    product: "Discussions",
    productTags: ["Discussions"],
    queries: [
      '"Discussions" error Laserfiche',
      '"Laserfiche Discussions" "error"',
      '"Discussions" "cannot connect" Laserfiche',
      '"Discussions" "repository" error Laserfiche',
      '"Discussions" "event log" Laserfiche',
    ],
  },
  {
    product: "Distributed Computing Cluster",
    productTags: ["Distributed Computing Cluster"],
    queries: [
      '"Distributed Computing Cluster" error Laserfiche',
      '"DCC" error Laserfiche',
      '"Laserfiche DCC" "error"',
      '"Distributed Computing Cluster" "worker" error',
      '"DCC" "scheduler" error Laserfiche',
    ],
  },
  {
    product: "Federated Search",
    productTags: ["Federated Search"],
    queries: [
      '"Federated Search" error Laserfiche',
      '"Laserfiche Federated Search" "error"',
      '"Federated Search" "Directory Server"',
      '"Federated Search" "license" error Laserfiche',
      '"Federated Search" "cannot connect" Laserfiche',
    ],
  },
  {
    product: "Forms",
    productTags: ["Forms"],
    queries: [
      'Forms "LFF" error',
      'Forms "submission failed" error',
      'Forms "routing service" error',
      'Forms "event log" error',
      'Forms "failed to generate" error',
      'Forms "LFF502" error',
      'Forms "LFF2400" error',
      'Forms "LFF706" error',
      'Forms "Save to Repository" error',
      'Forms "Workflow API" error',
      'Forms "NotificationServerConnectionDown"',
    ],
  },
  {
    product: "Full Text Search",
    productTags: ["Full Text Search"],
    queries: [
      '"Full Text Search" error Laserfiche',
      '"Laserfiche Full Text Search" "error"',
      '"LFFTS" error Laserfiche',
      '"Full Text Search" "index" error Laserfiche',
      '"Full Text Search" "catalog" error Laserfiche',
    ],
  },
  {
    product: "Import Agent",
    productTags: ["Import Agent"],
    queries: [
      '"Import Agent" error Laserfiche',
      '"Laserfiche Import Agent" "error"',
      '"Import Agent" "profile" error Laserfiche',
      '"Import Agent" "OCR" error Laserfiche',
      '"Import Agent" "repository" error Laserfiche',
    ],
  },
  {
    product: "Laserfiche Installer",
    productTags: ["Laserfiche Installer"],
    queries: [
      '"Laserfiche Installer" error',
      '"Laserfiche" "installation" "error"',
      '"Laserfiche" "installer" "failed"',
      '"Laserfiche" "setup" "error"',
      '"Laserfiche" "prerequisite" "error"',
    ],
  },
  {
    product: "Laserfiche Server/Repository Server",
    productTags: ["Laserfiche Server/Repository Server"],
    queries: [
      '"Laserfiche Server" error',
      '"Repository Server" error Laserfiche',
      '"LFServer" error Laserfiche',
      '"Laserfiche Server" "repository" error',
      '"Laserfiche Server" "cannot connect"',
      '"Laserfiche Server" "9008"',
      '"Laserfiche Server" "9025"',
      '"Laserfiche Server" "9044"',
      '"Laserfiche Server" "Operation timed out"',
      '"Laserfiche Server" "volume" error',
    ],
  },
  {
    product: "Mobile",
    productTags: ["Mobile"],
    queries: [
      '"Mobile" error Laserfiche',
      '"Laserfiche Mobile" "error"',
      '"Mobile Server" error Laserfiche',
      '"Laserfiche Mobile" "Directory Server"',
      '"Laserfiche Mobile" "cannot connect"',
    ],
  },
  {
    product: "Office Integration",
    productTags: ["Office Integration"],
    queries: [
      '"Office Integration" error Laserfiche',
      '"Laserfiche Office Integration" "error"',
      '"Laserfiche Office Plugin" error',
      '"Office Integration" "Word" error Laserfiche',
      '"Office Integration" "Outlook" error Laserfiche',
    ],
  },
  {
    product: "Quick Fields",
    productTags: ["Quick Fields"],
    queries: [
      '"Quick Fields" error Laserfiche',
      '"Laserfiche Quick Fields" "error"',
      '"Quick Fields" "session" error',
      '"Quick Fields" "scan" error Laserfiche',
      '"Quick Fields" "OCR" error Laserfiche',
    ],
  },
  {
    product: "Records Management",
    productTags: ["Records Management"],
    queries: [
      '"Records Management" error Laserfiche',
      '"Laserfiche Records Management" "error"',
      '"Records Management" "cutoff" error',
      '"Records Management" "retention" error',
      '"Records Management" "record series" error',
    ],
  },
  {
    product: "Snapshot",
    productTags: ["Snapshot"],
    queries: [
      '"Snapshot" error Laserfiche',
      '"Laserfiche Snapshot" "error"',
      '"Snapshot" "printer" error Laserfiche',
      '"Snapshot" "PDF" error Laserfiche',
      '"Snapshot" "cannot connect" Laserfiche',
    ],
  },
  {
    product: "Workflow",
    productTags: ["Workflow"],
    queries: [
      'Workflow "WF" error',
      'Workflow "Subscriber" error',
      'Workflow "activity" error',
      'Workflow "terminated" error',
      'Workflow "repository" error',
      'Workflow "WF0" error',
      'Workflow "WF1" error',
      'Workflow "ManagementService" error',
      'Workflow "publish" error',
      'Workflow "connection profile" error',
    ],
  },
  {
    product: "Web Client",
    productTags: ["Web Client"],
    queries: [
      '"Web Client" error Laserfiche',
      '"Web Access" error Laserfiche',
      '"Web Client" "HTTP Error" Laserfiche',
      '"Web Client" "repository" error',
      '"Web Client" "scanning" error',
      '"Web Access" "HTTP Error" Laserfiche',
      '"Web Access" repository error',
      '"Web Scanning" error Laserfiche',
      '"Web Client" "Access Denied" Laserfiche',
      '"Web Client" "Unknown internal error"',
      '"Web Access" "500.19"',
      '"Web Client" "XSRF" error',
      '"Web Client" "HTTP 503"',
      '"Web Scanning" "not loading"',
      '"Web Client" "Effective Rights"',
    ],
  },
  {
    product: "WebLink",
    productTags: ["WebLink"],
    queries: [
      '"WebLink" error Laserfiche',
      '"Laserfiche WebLink" "error"',
      '"WebLink" "repository" error Laserfiche',
      '"WebLink" "HTTP Error" Laserfiche',
      '"WebLink" "cannot connect" Laserfiche',
    ],
  },
  {
    product: "Webtools Agent",
    productTags: ["Webtools Agent"],
    queries: [
      '"Webtools Agent" error Laserfiche',
      '"Laserfiche Webtools Agent" "error"',
      '"Webtools" "agent" "cannot connect" Laserfiche',
      '"Webtools Agent" "event log" Laserfiche',
      '"Webtools Agent" "repository" error Laserfiche',
    ],
  },
  {
    product: "Windows Client/Desktop Client",
    productTags: ["Windows Client/Desktop Client"],
    queries: [
      '"Windows Client" error Laserfiche',
      '"Desktop Client" error Laserfiche',
      '"Laserfiche Client" "error"',
      '"Laserfiche Client" "repository" error',
      '"Laserfiche Client" "cannot connect"',
      '"LF.exe" "Exception code"',
      '"Laserfiche Client" "Operation timed out"',
      '"Laserfiche Client" "Import" error',
      '"Laserfiche Client" "Email" error',
      '"Laserfiche Client" "OCR" error',
    ],
  },
];

const selectedSearches = isAllProducts
  ? productSearches
  : productSearches.filter((search) => search.product.toLowerCase() === requestedProduct.toLowerCase());

if (selectedSearches.length === 0) {
  throw new Error(`Unknown product "${requestedProduct}". Known products: ${productSearches.map((search) => search.product).join(", ")}`);
}

const existingResults = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
const existingUrls = new Set([
  ...reviewedSources.map((source) => normalizeUrl(source.url)),
  ...existingResults.map((row) => normalizeUrl(row.url)),
]);

const newRows = [];
let addedRowsCount = 0;
const passSummary = [];

for (const search of selectedSearches) {
  const collected = [];
  const seenThisProduct = new Set();

  console.log(`Starting ${search.product} (${targetCount} requested)`);
  for (const query of search.queries) {
    for (let page = 1; page <= maxPagesPerQuery && collected.length < targetCount; page += 1) {
      const searchUrl = answersSearchUrl(query, page);
      let html = "";
      try {
        html = await fetchText(searchUrl);
      } catch (error) {
        console.warn(`Skipping search page for ${search.product}: ${searchUrl} (${error.message})`);
        continue;
      }
      const candidates = extractSearchCandidates(html);

      for (const candidate of candidates) {
        const url = normalizeUrl(candidate.url);
        if (existingUrls.has(url) || seenThisProduct.has(url)) continue;

        seenThisProduct.add(url);
        let detail;
        try {
          detail = await fetchQuestionDetail(url);
        } catch (error) {
          console.warn(`Skipping detail for ${search.product}: ${url} (${error.message})`);
          continue;
        }
        const row = {
          product: search.product,
          query,
          page,
          signature: detail.signature,
          signatureType: detail.signatureType,
          title: detail.title || candidate.title,
          url,
          snippet: detail.snippet || candidate.snippet,
          sourceType: detail.sourceType,
          discoveredDate: today,
          status: detail.status,
          reviewedDate: today,
          productTags: detail.productTags.length ? detail.productTags : search.productTags,
          extractedErrorCodes: detail.extractedErrorCodes,
          notes: detail.notes,
        };

        collected.push(row);
        newRows.push(row);
        addedRowsCount += 1;
        existingUrls.add(url);
        if (collected.length >= targetCount) break;
      }
    }
  }

  passSummary.push({
    product: search.product,
    requested: targetCount,
    collected: collected.length,
    rows: collected.map(({ title, url, extractedErrorCodes, status }) => ({
      title,
      url,
      extractedErrorCodes,
      status,
    })),
  });
  writeOutputs();
  console.log(`Finished ${search.product}: ${collected.length}/${targetCount}`);
}

writeOutputs();

console.log(`Added ${addedRowsCount} new Answers candidates.`);
for (const product of passSummary) {
  console.log(`${product.product}: ${product.collected}/${product.requested}`);
}
console.log(passPath);

function writeOutputs() {
  if (newRows.length > 0) {
  existingResults.push(...newRows);
  newRows.length = 0;
  fs.writeFileSync(resultsPath, `${JSON.stringify(existingResults, null, 2)}\n`);
}

fs.writeFileSync(
  passPath,
  `${JSON.stringify(
    {
      reviewedDate: today,
      targetCount,
      products: passSummary,
    },
    null,
    2,
  )}\n`,
);
}

function answersSearchUrl(query, page) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return `https://answers.laserfiche.com/questions?${params}`;
}

async function fetchQuestionDetail(url) {
  const html = await fetchText(url);
  const title = readableTitle(
    cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") ||
      cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ""),
    url,
  );
  const text = htmlToText(html);
  const extractedErrorCodes = extractErrorCodes(`${title} ${text}`);
  const productTags = extractProductTags(text);
  const hasLaserficheReply = /\b(?:Laserfiche employee|from Laserfiche|Laserfiche staff)\b/i.test(text);
  const hasAcceptedOrResolved = /\b(?:accepted answer|resolved|fixed|solution|workaround)\b/i.test(text);
  const status = extractedErrorCodes.length ? "candidate" : "reviewed-no-code";
  const sourceType = hasLaserficheReply
    ? "Answers candidate - Laserfiche employee"
    : hasAcceptedOrResolved
      ? "Answers candidate - community confirmed"
      : "Answers candidate";

  return {
    title,
    signature: extractedErrorCodes[0] || title,
    signatureType: extractedErrorCodes[0] ? "error-code" : "message-text",
    snippet: relevantSnippet(text, extractedErrorCodes[0] || "error"),
    sourceType,
    productTags,
    extractedErrorCodes,
    status,
    notes: hasLaserficheReply
      ? "Fresh Answers pass candidate. Detail page text indicates a Laserfiche-associated reply may be present; review before promotion."
      : "Fresh Answers pass candidate. Review detail page before promotion.",
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`${response.status} while fetching ${url}`);
  }
  return response.text();
}

function extractSearchCandidates(html) {
  const candidates = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/questions\/\d+\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const url = normalizeUrl(match[1]);
    const title = cleanText(match[2]);
    if (!title || seen.has(url)) continue;
    seen.add(url);
    candidates.push({ url, title, snippet: title });
  }
  return candidates;
}

function extractErrorCodes(text) {
  const codes = new Set();
  const patterns = [
    /\bLFF\d{3,5}(?:-[A-Za-z0-9]+)?\b/g,
    /\b\d{3,4}-WF\d+\b/g,
    /\b\d{4,5}-[A-Z]{2}\d*\b/g,
    /\b0x[0-9A-Fa-f]{6,8}\b/g,
    /\bHTTP\s*(?:Error\s*)?\d{3}(?:\.\d+)?\b/gi,
    /\b(?:error|code)\s*\[?(\d{3,5})\]?\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      codes.add((match[1] || match[0]).replace(/\s+/g, " ").trim());
    }
  }

  return [...codes].slice(0, 8);
}

function extractProductTags(text) {
  const tags = [];
  const productChecks = [
    ["Forms", /\bForms\b/i],
    ["Workflow", /\bWorkflow\b/i],
    ["Web Client", /\bWeb Client\b|\bWeb Access\b/i],
    ["Web Client", /\bWeb Scanning\b|\bscanning\b/i],
    ["Directory Server", /\bDirectory Server\b|\bLFDS\b/i],
    ["Laserfiche Server/Repository Server", /\bRepository\b|\bLaserfiche Server\b/i],
  ];
  for (const [tag, pattern] of productChecks) {
    if (pattern.test(text)) tags.push(tag);
  }
  for (const version of ["9", "10", "11", "12"]) {
    if (new RegExp(`\\b(?:Version\\s*)?${version}(?:\\.\\d+)?\\b`, "i").test(text)) {
      tags.push(`Version ${version}`);
    }
  }
  return [...new Set(tags)];
}

function htmlToText(html) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function relevantSnippet(text, needle) {
  const index = text.toLowerCase().indexOf(String(needle).toLowerCase());
  const start = Math.max(0, index === -1 ? 0 : index - 220);
  return text.slice(start, start + 520).trim();
}

function cleanText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function readableTitle(value, url) {
  const cleaned = value.replace(/\s+-\s+Laserfiche Answers\s*$/i, "").replace(/^(Question|Discussion|Announcement)\s+/i, "");
  if (cleaned && !/^Question$|^Discussion$|^Announcement$/i.test(cleaned)) return cleaned;

  const slug = new URL(url).pathname.split("/").filter(Boolean).at(-1) || "";
  return decodeURIComponent(slug).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value) {
  const url = new URL(value, "https://answers.laserfiche.com");
  url.search = "";
  url.hash = "";
  return url.toString();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nextAvailablePassPath(basePath) {
  if (!fs.existsSync(basePath)) return basePath;

  const parsed = path.parse(basePath);
  for (let index = 2; ; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

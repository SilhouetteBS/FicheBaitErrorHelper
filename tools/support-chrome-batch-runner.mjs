import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const today = process.env.RESEARCH_DATE ?? new Date().toISOString().slice(0, 10);
const statePath = path.join(cwd, "research", `support-chrome-search-state-${today}.json`);
const logPath = path.join(cwd, "research", "support-kb-review-log.json");
const reviewedSourcesPath = path.join(cwd, "src", "data", "reviewedSources.js");

const queries = [
  "error",
  "error occurs",
  "error message",
  "failed",
  "failure",
  "exception",
  "internal server error",
  "unable to",
  "cannot",
  "timeout",
  "not found",
  "access denied",
  "Laserfiche Server error",
  "Repository error",
  "Directory Server error",
  "Forms error",
  "Workflow error",
  "Web Client error",
  "WebLink error",
  "Quick Fields error",
  "Import Agent error",
  "Snapshot error",
  "Connector error",
  "Audit Trail error",
  "Mobile error",
  "API Server error",
  "Office Integration error",
  "Webtools Agent error",
  "Activation error",
  "license error",
  "HTTP 500",
  "401 Unauthorized",
  "STATUS_BREAKPOINT",
  "AADSTS",
  "Base-64 string",
  "Could not create required control",
  "LFF error",
  "LFF500",
  "LFF502",
  "LFF5203",
  "LFF5426",
  "LFDS error",
  "LFDS10",
  "LFDS23",
  "LFAH error",
  "LFSO error",
  "Workflow API was not successful",
  "Object reference not set",
  "Operation timed out",
  "No response received from the server",
  "Could not find file",
  "InvalidCastException",
  "RPC server unavailable",
  "database error",
  "SQL error",
  "SAML error",
  "TLS 1.2 error",
  "browser is not configured correctly",
  "Laserfiche Web Client 11 error",
  "Laserfiche Forms 11 error",
  "Laserfiche Workflow 11 error",
  "Laserfiche Directory Server 11 error",
  "Laserfiche Connector 11 error",
  "Laserfiche Quick Fields 11 error",
  "Laserfiche WebLink 11 error",
  "Laserfiche Import Agent 11 error",
  "Laserfiche Snapshot 10 error",
  "Laserfiche Mobile Server 11 error",
];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, "https://support.laserfiche.com");
    url.hash = "";
    return url.toString();
  } catch {
    return String(value || "");
  }
}

function searchUrl(query, page) {
  return `https://support.laserfiche.com/search?${new URLSearchParams({
    q: query,
    category: "Knowledge Base",
    page: String(page),
    byDate: "false",
  })}`;
}

export function supportChromeSearchUrl(query, page = 1) {
  return searchUrl(query, page);
}

function supportSourceIds() {
  const ids = new Set();
  const log = readJson(logPath, { reviewedResults: [] });
  for (const row of log.reviewedResults ?? []) {
    if (row.kbId) ids.add(String(row.kbId));
  }
  for (const name of fs.readdirSync(path.join(cwd, "research")).filter((file) => /^support-chrome-search-state-\d{4}-\d{2}-\d{2}\.json$/.test(file))) {
    const historicalState = readJson(path.join(cwd, "research", name), {});
    for (const id of historicalState.visitedKbIds ?? []) ids.add(String(id));
  }

  if (fs.existsSync(reviewedSourcesPath)) {
    const sourceText = fs.readFileSync(reviewedSourcesPath, "utf8");
    for (const match of sourceText.matchAll(/https:\/\/support\.laserfiche\.com\/kb\/(\d+)\/[^"\s]+/g)) {
      ids.add(match[1]);
    }
  }

  return ids;
}

function latestHistoricalState() {
  const candidates = fs
    .readdirSync(path.join(cwd, "research"))
    .filter((file) => /^support-chrome-search-state-\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .filter((file) => path.join(cwd, "research", file) !== statePath)
    .sort();
  return candidates.length > 0 ? readJson(path.join(cwd, "research", candidates.at(-1)), {}) : {};
}

function kbIdFromUrl(url) {
  return String(url || "").match(/\/kb\/(\d+)/i)?.[1] ?? null;
}

function staticSupportKbIds() {
  return new Set(["1012113", "1012418", "1013772", "1012253"]);
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

async function extractSearchResults(tab, query, page) {
  await tab.goto(searchUrl(query, page));
  await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 15000 });
  await waitForSearchResultsToSettle(tab);
  return tab.playwright.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href*="/kb/"]')];
    const rows = [];
    const seen = new Set();
    for (const anchor of anchors) {
      const href = anchor.href;
      const id = href.match(/\/kb\/(\d+)/i)?.[1];
      if (!id || seen.has(id) || ["1012113", "1012418", "1013772", "1012253"].includes(id)) continue;
      seen.add(id);
      const title = (anchor.innerText || "").replace(/\s+/g, " ").trim();
      if (!title || title === "Read the Article") continue;
      const container = anchor.closest("article, li, .card, .result, .search-result, div") || anchor;
      const snippet = (container.innerText || title).replace(/\s+/g, " ").trim();
      rows.push({ kbId: id, title, url: href, snippet: snippet.slice(0, 700) });
    }
    return rows;
  }, null, { timeoutMs: 15000 });
}

export async function validateSupportSearchPage(tab, query = "error", page = 1) {
  await tab.goto(searchUrl(query, page));
  await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 15000 });
  await waitForSearchResultsToSettle(tab);
  return tab.playwright.evaluate(() => {
    const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const resultCountText =
      bodyText.match(/\b\d[\d,]*\s+results?\s+found\b/i)?.[0] ??
      bodyText.match(/\b\d[\d,]*\s+results?\b/i)?.[0] ??
      "";
    const anchors = [...document.querySelectorAll('a[href*="/kb/"]')];
    const links = [];
    const seen = new Set();
    for (const anchor of anchors) {
      const href = anchor.href;
      const id = href.match(/\/kb\/(\d+)/i)?.[1];
      const title = (anchor.innerText || "").replace(/\s+/g, " ").trim();
      if (!id || ["1012113", "1012418", "1013772", "1012253"].includes(id) || seen.has(id) || !title || title === "Read the Article") continue;
      seen.add(id);
      links.push({ kbId: id, title, url: href });
    }
    return {
      url: location.href,
      title: document.title,
      resultCountText,
      linkCount: links.length,
      firstLinks: links.slice(0, 10),
      bodyStart: bodyText.slice(0, 1200),
    };
  }, null, { timeoutMs: 12000 });
}

async function extractKbDetail(tab, result, query, page) {
  await tab.goto(result.url);
  await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 15000 });
  await tab.playwright.waitForTimeout(1200);
  const detail = await tab.playwright.evaluate(() => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const h1 = document.querySelector("h1")?.innerText?.replace(/\s+/g, " ").trim();
    const title = h1 || document.title.replace(/\s+/g, " ").trim();
    const links = [...document.querySelectorAll("a[href]")]
      .map((anchor) => ({
        text: (anchor.innerText || "").replace(/\s+/g, " ").trim(),
        href: anchor.href,
      }))
      .filter((link) => link.text || link.href)
      .slice(0, 30);
    return { title, text: text.slice(0, 5000), links };
  }, null, { timeoutMs: 15000 });

  const text = `${detail.title} ${detail.text}`;
  const extractedErrorCodes = [
    ...new Set(
      [
        ...text.matchAll(/\b(?:LFF|LFDS|LFSO|LFAH|HTTP|AADSTS)?[- ]?\d{3,6}(?:[- ][A-Z][A-Z0-9]+)?\b/g),
        ...text.matchAll(/\b0x[0-9a-fA-F]{8}\b/g),
        ...text.matchAll(/\b[A-Z][A-Z0-9]+-[A-Z][A-Z0-9-]+\b/g),
      ]
        .map((match) => match[0].trim())
        .filter((value) => /\d/.test(value)),
    ),
  ].slice(0, 12);

  const productHints = [
    "Administration Hub",
    "AI Service",
    "API Server",
    "Audit Trail",
    "Connector",
    "Directory Server",
    "Forms",
    "Full Text Search",
    "Import Agent",
    "Laserfiche Installer",
    "Laserfiche Server",
    "Mobile",
    "Office Integration",
    "Quick Fields",
    "Snapshot",
    "Web Client",
    "WebLink",
    "Webtools Agent",
    "Windows Client",
    "Workflow",
  ].filter((product) => text.toLowerCase().includes(product.toLowerCase()));

  return {
    ...result,
    query,
    page,
    detailTitle: detail.title,
    detailText: detail.text,
    extractedErrorCodes,
    productHints,
    links: detail.links,
    reviewedDate: today,
    status: extractedErrorCodes.length ? "support-candidate" : "support-reviewed-no-code",
  };
}

async function waitForSearchResultsToSettle(tab) {
  let lastCount = -1;
  let stableReads = 0;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await tab.playwright.evaluate(() => {
      const kbLinks = document.querySelectorAll('a[href*="/kb/"]').length;
      const bodyText = (document.body?.innerText || "").toLowerCase();
      const resultsFound =
        bodyText.match(/\b\d+\s+results?\s+found\b/)?.[0] ??
        bodyText.match(/\bresults?\s+found\b/)?.[0] ??
        "";
      const hasSearchUi = bodyText.includes("filters reset products versions categories");
      return {
        kbLinks,
        resultsFound,
        hasSearchUi,
        hasNoResultsText: bodyText.includes("no results") || bodyText.includes("no articles found"),
        isLoading: bodyText.includes("loading") || bodyText.includes("please wait"),
      };
    }, null, { timeoutMs: 8000 });

    if ((state.resultsFound || state.hasSearchUi) && state.kbLinks === lastCount && !state.isLoading) stableReads += 1;
    else stableReads = 0;

    if (stableReads >= 2 || state.hasNoResultsText) return;
    lastCount = state.kbLinks;
    await tab.playwright.waitForTimeout(1000);
  }
}

export async function runSupportChromeBatch(tab, batchSize = 25, maxPagesPerRun = 8, options = {}) {
  const previousState = latestHistoricalState();
  const state = readJson(statePath, {
    startedAt: new Date().toISOString(),
    cursor: previousState.cursor ?? { queryIndex: 0, page: 1 },
    visitedKbIds: [],
    visitedUrls: [],
    batches: [],
  });
  state.visitedKbIds ||= [];
  state.visitedUrls ||= [];
  state.batches ||= [];

  const reviewedKbIds = supportSourceIds();
  for (const id of staticSupportKbIds()) reviewedKbIds.add(id);
  for (const id of state.visitedKbIds) reviewedKbIds.add(String(id));

  const appendToIncomplete = options.appendToIncomplete !== false;
  const lastBatch = state.batches.at(-1);
  const canAppendToLastBatch =
    appendToIncomplete &&
    lastBatch &&
    lastBatch.count > 0 &&
    lastBatch.count < batchSize &&
    fs.existsSync(path.join(cwd, lastBatch.batchPath));
  const batchNumber = canAppendToLastBatch ? lastBatch.batchNumber : (state.batches.length || 0) + 1;
  const batchPath = canAppendToLastBatch
    ? path.join(cwd, lastBatch.batchPath)
    : path.join(cwd, "research", `support-chrome-search-batch-${today}-${String(batchNumber).padStart(2, "0")}.json`);
  const mdPath = canAppendToLastBatch
    ? path.join(cwd, lastBatch.mdPath)
    : path.join(cwd, "research", `support-chrome-search-batch-${today}-${String(batchNumber).padStart(2, "0")}.md`);
  const batch = canAppendToLastBatch ? readJson(batchPath, { rows: [] }).rows ?? [] : [];
  const startingCount = batch.length;
  const cursor = state.cursor || { queryIndex: 0, page: 1 };
  let pagesChecked = 0;

  while (batch.length < batchSize && cursor.queryIndex < queries.length && pagesChecked < maxPagesPerRun) {
    const query = queries[cursor.queryIndex];
    const page = cursor.page || 1;
    pagesChecked += 1;

    let results = [];
    try {
      results = await extractSearchResults(tab, query, page);
    } catch (error) {
      state.lastError = `${query} page ${page}: ${error.message}`;
    }

    cursor.page = page + 1;
    if (results.length === 0 || cursor.page > 10) {
      cursor.queryIndex += 1;
      cursor.page = 1;
    }

    for (const result of results) {
      const kbId = result.kbId || kbIdFromUrl(result.url);
      const url = normalizeUrl(result.url);
      if (!kbId || reviewedKbIds.has(String(kbId)) || state.visitedUrls.includes(url)) continue;

      reviewedKbIds.add(String(kbId));
      state.visitedKbIds.push(String(kbId));
      state.visitedUrls.push(url);

      try {
        batch.push(await extractKbDetail(tab, { ...result, url }, query, page));
      } catch (error) {
        batch.push({
          ...result,
          url,
          query,
          page,
          reviewedDate: today,
          status: "fetch-error",
          error: error.message,
        });
      }

      if (batch.length >= batchSize) break;
    }
  }

  state.cursor = cursor;
  state.updatedAt = new Date().toISOString();

  writeJson(batchPath, { batchNumber, reviewedDate: today, count: batch.length, cursor, rows: batch });

  const report = [
    "# Support Chrome Search Batch",
    "",
    `Batch: ${batchNumber}`,
    `Reviewed: ${today}`,
    `Rows: ${batch.length}`,
    "",
    "| KB | Status | Codes | Products | Title |",
    "| --- | --- | --- | --- | --- |",
    ...batch.map(
      (row) =>
        `| ${row.kbId || ""} | ${row.status || ""} | ${markdownEscape((row.extractedErrorCodes || []).join(", ") || "None")} | ${markdownEscape((row.productHints || []).join(", ") || "None")} | [${markdownEscape(row.detailTitle || row.title)}](${row.url}) |`,
    ),
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, report);

  const batchRecord = {
    batchNumber,
    batchPath: path.relative(cwd, batchPath).replaceAll("\\", "/"),
    mdPath: path.relative(cwd, mdPath).replaceAll("\\", "/"),
    count: batch.length,
    createdAt: canAppendToLastBatch ? lastBatch.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (canAppendToLastBatch) state.batches[state.batches.length - 1] = batchRecord;
  else state.batches.push(batchRecord);
  writeJson(statePath, state);

  return {
    batchNumber,
    count: batch.length,
    appended: batch.length - startingCount,
    cursor,
    batchPath: path.relative(cwd, batchPath),
    mdPath: path.relative(cwd, mdPath),
    statusCounts: batch.reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, {}),
  };
}

export async function runSupportChromeQueryBatch(tab, query = "error", batchSize = 25, maxPagesPerRun = 5, options = {}) {
  const previousState = latestHistoricalState();
  const state = readJson(statePath, {
    startedAt: new Date().toISOString(),
    cursor: previousState.cursor ?? { queryIndex: 0, page: 1 },
    visitedKbIds: [],
    visitedUrls: [],
    batches: [],
    queryCursors: previousState.queryCursors ?? {},
  });
  state.visitedKbIds ||= [];
  state.visitedUrls ||= [];
  state.batches ||= [];
  state.queryCursors ||= {};

  const reviewedKbIds = supportSourceIds();
  for (const id of staticSupportKbIds()) reviewedKbIds.add(id);
  for (const id of state.visitedKbIds) reviewedKbIds.add(String(id));

  const cursorKey = `query:${query}`;
  const cursor = state.queryCursors[cursorKey] || { page: options.startPage || 1, done: false };

  const appendToIncomplete = options.appendToIncomplete !== false;
  const lastBatch = state.batches.at(-1);
  const canAppendToLastBatch =
    appendToIncomplete &&
    lastBatch &&
    lastBatch.count > 0 &&
    lastBatch.count < batchSize &&
    fs.existsSync(path.join(cwd, lastBatch.batchPath));
  const batchNumber = canAppendToLastBatch ? lastBatch.batchNumber : (state.batches.length || 0) + 1;
  const batchPath = canAppendToLastBatch
    ? path.join(cwd, lastBatch.batchPath)
    : path.join(cwd, "research", `support-chrome-search-batch-${today}-${String(batchNumber).padStart(2, "0")}.json`);
  const mdPath = canAppendToLastBatch
    ? path.join(cwd, lastBatch.mdPath)
    : path.join(cwd, "research", `support-chrome-search-batch-${today}-${String(batchNumber).padStart(2, "0")}.md`);
  const batch = canAppendToLastBatch ? readJson(batchPath, { rows: [] }).rows ?? [] : [];
  const startingCount = batch.length;
  let pagesChecked = 0;

  while (!cursor.done && batch.length < batchSize && pagesChecked < maxPagesPerRun) {
    const page = cursor.page || 1;
    pagesChecked += 1;

    let results = [];
    try {
      results = await extractSearchResults(tab, query, page);
    } catch (error) {
      state.lastError = `${query} page ${page}: ${error.message}`;
    }

    cursor.page = page + 1;
    if (results.length === 0) {
      cursor.done = true;
      break;
    }

    for (const result of results) {
      const kbId = result.kbId || kbIdFromUrl(result.url);
      const url = normalizeUrl(result.url);
      if (!kbId || reviewedKbIds.has(String(kbId)) || state.visitedUrls.includes(url)) continue;

      reviewedKbIds.add(String(kbId));
      state.visitedKbIds.push(String(kbId));
      state.visitedUrls.push(url);

      try {
        batch.push(await extractKbDetail(tab, { ...result, url }, query, page));
      } catch (error) {
        batch.push({
          ...result,
          url,
          query,
          page,
          reviewedDate: today,
          status: "fetch-error",
          error: error.message,
        });
      }

      if (batch.length >= batchSize) break;
    }
  }

  state.queryCursors[cursorKey] = cursor;
  state.updatedAt = new Date().toISOString();

  if (batch.length === 0 && startingCount === 0) {
    writeJson(statePath, state);
    return {
      batchNumber,
      count: 0,
      appended: 0,
      query,
      cursor,
      batchPath: path.relative(cwd, batchPath),
      mdPath: path.relative(cwd, mdPath),
      statusCounts: {},
    };
  }

  writeJson(batchPath, { batchNumber, reviewedDate: today, count: batch.length, cursor, rows: batch });

  const report = [
    "# Support Chrome Search Batch",
    "",
    `Batch: ${batchNumber}`,
    `Reviewed: ${today}`,
    `Rows: ${batch.length}`,
    "",
    "| KB | Status | Codes | Products | Title |",
    "| --- | --- | --- | --- | --- |",
    ...batch.map(
      (row) =>
        `| ${row.kbId || ""} | ${row.status || ""} | ${markdownEscape((row.extractedErrorCodes || []).join(", ") || "None")} | ${markdownEscape((row.productHints || []).join(", ") || "None")} | [${markdownEscape(row.detailTitle || row.title)}](${row.url}) |`,
    ),
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, report);

  const batchRecord = {
    batchNumber,
    batchPath: path.relative(cwd, batchPath).replaceAll("\\", "/"),
    mdPath: path.relative(cwd, mdPath).replaceAll("\\", "/"),
    count: batch.length,
    createdAt: canAppendToLastBatch ? lastBatch.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (canAppendToLastBatch) state.batches[state.batches.length - 1] = batchRecord;
  else state.batches.push(batchRecord);
  writeJson(statePath, state);

  return {
    batchNumber,
    count: batch.length,
    appended: batch.length - startingCount,
    query,
    cursor,
    batchPath: path.relative(cwd, batchPath),
    mdPath: path.relative(cwd, mdPath),
    statusCounts: batch.reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, {}),
  };
}

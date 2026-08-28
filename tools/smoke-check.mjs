import { chromium } from "playwright";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { browserLaunchOptions } from "./browser-launch.mjs";
import AxeBuilder from "@axe-core/playwright";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "dist");
let server;
let browser;

async function expectVisible(locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    throw new Error(message);
  }
}

function contentType(filePath) {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  return types[extname(filePath)] ?? "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolveServer) => {
    const staticServer = createServer((request, response) => {
      const rawPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      const sitePath = rawPath.replace(/^\/FicheBaitErrorHelper\/?/, "");
      const relativePath = sitePath || "index.html";
      const resolvedPath = normalize(resolve(distDir, relativePath));
      const filePath = resolvedPath.startsWith(distDir) && existsSync(resolvedPath) ? resolvedPath : join(distDir, "index.html");
      response.setHeader("Content-Type", contentType(filePath));
      createReadStream(filePath).pipe(response);
    });
    staticServer.listen(0, "127.0.0.1", () => resolveServer(staticServer));
  });
}

try {
  if (!existsSync(join(distDir, "index.html"))) {
    throw new Error("dist/index.html is missing. Run npm run build before npm run smoke.");
  }
  server = await startStaticServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/FicheBaitErrorHelper/`;
  browser = await chromium.launch(browserLaunchOptions());
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Get started"), "First-visit instructions were not visible.");
  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  const seriousAccessibilityIssues = accessibilityResults.violations.filter((issue) => ["serious", "critical"].includes(issue.impact));
  if (seriousAccessibilityIssues.length) {
    throw new Error(`Accessibility violations: ${seriousAccessibilityIssues.flatMap((issue) => issue.nodes.map((node) => `${issue.id} (${node.target.join(" ")})`)).join(", ")}`);
  }

  await page.getByRole("button", { name: "How it works" }).click();
  await expectVisible(page.getByRole("heading", { name: "How It Works" }), "How It Works dialog did not open.");
  if (!(await page.getByRole("button", { name: "Close dialog" }).evaluate((button) => button === document.activeElement))) {
    throw new Error("How It Works dialog did not move focus to its close control.");
  }
  await page.keyboard.press("Escape");
  if (await page.getByRole("dialog").isVisible().catch(() => false)) throw new Error("Escape did not close the dialog.");

  await page.getByRole("button", { name: "About" }).click();
  const aboutDialog = page.getByRole("dialog");
  await expectVisible(aboutDialog.getByText("not affiliated with or endorsed by Laserfiche"), "About disclaimer was not visible.");
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "More Filters" }).click();
  await expectVisible(page.getByLabel("More filters"), "More Filters panel did not open.");
  await page.getByLabel("Validation", { exact: true }).selectOption("official-doc-baseline");
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "More Filters" }).click();
  if ((await page.getByLabel("Validation", { exact: true }).inputValue()) !== "All") {
    throw new Error("Reset did not clear Validation.");
  }

  await page.getByRole("button", { name: "More Filters" }).click();
  await page.getByRole("button", { name: "Open result filters" }).click();
  await expectVisible(page.getByLabel("More filters"), "Result-pane filter icon did not open More Filters.");

  await page.getByPlaceholder("Search code, message, symptom, product, or fix").fill("Web Access");
  await page.waitForURL(/q=Web\+Access/);
  await expectVisible(page.getByRole("button", { name: /Web Client/ }).first(), "Web Access alias did not return Web Client results.");

  await page.getByPlaceholder("Search code, message, symptom, product, or fix").fill("9030");
  await page.waitForURL(/q=9030/);
  await page.waitForFunction(() => Number.parseInt(document.querySelector(".pane-heading h2")?.textContent ?? "", 10) <= 10);
  const numericResultText = await page.locator(".pane-heading h2").textContent();
  const numericResultCount = Number.parseInt(numericResultText, 10);
  if (!Number.isFinite(numericResultCount) || numericResultCount < 1 || numericResultCount > 10) {
    throw new Error(`Numeric search returned an implausible result count: ${numericResultText}`);
  }
  const resultGroup = page.getByRole("button", { name: /Laserfiche Server\/Repository Server/ });
  if ((await resultGroup.getAttribute("aria-expanded")) !== "true") {
    throw new Error("An exact error-code search did not expand its matching product group.");
  }
  await page.getByRole("button", { name: /9030 Maximum sessions or licensing limit reached/ }).click();
  await page.waitForURL(/error=/);
  await expectVisible(page.getByRole("button", { name: "Share", exact: true }), "Share action was not visible.");
  const correctionLink = page.getByRole("link", { name: "Report Correction" });
  await expectVisible(correctionLink, "Report correction link was not visible.");
  const href = await correctionLink.getAttribute("href");
  if (!href?.includes("ISSUE_TEMPLATE") && !href?.includes("template=error-report.yml")) {
    throw new Error("Correction link does not point to the error-report issue template.");
  }
  if (href.length > 1500) throw new Error(`Correction link is too long: ${href.length} characters.`);

  const answersContribution = page.getByRole("button", { name: "Contribute on Answers", exact: true });
  await expectVisible(answersContribution, "Top Answers contribution action was not visible for an Answers-backed entry.");
  await answersContribution.click();
  const answersDialog = page.getByRole("dialog", { name: "Share a troubleshooting outcome" });
  await expectVisible(answersDialog, "Answers contribution dialog did not open.");
  const answersTargetSelect = answersDialog.getByLabel("Answers discussion or scenario");
  await expectVisible(answersTargetSelect, "An entry with multiple Answers sources did not provide a source selector.");
  if ((await answersTargetSelect.locator("option").count()) < 2) {
    throw new Error("Answers source selector did not include the entry's multiple discussions.");
  }
  await answersTargetSelect.selectOption("1");
  await answersDialog.getByLabel("Laserfiche version and build").fill("Version 12 build 1202");
  await answersDialog.getByLabel("Outcome").selectOption("partially-helped");
  await expectVisible(
    answersDialog.getByText("This partially helped in my environment, but additional troubleshooting was still required.", { exact: false }),
    "Answers response preview did not update with conversational outcome text.",
  );
  const answersAccessibilityResults = await new AxeBuilder({ page }).include(".answers-contribution-dialog").analyze();
  const seriousAnswersAccessibilityIssues = answersAccessibilityResults.violations.filter((issue) => ["serious", "critical"].includes(issue.impact));
  if (seriousAnswersAccessibilityIssues.length) {
    throw new Error(`Answers dialog accessibility violations: ${seriousAnswersAccessibilityIssues.flatMap((issue) => issue.nodes.map((node) => `${issue.id} (${node.target.join(" ")})`)).join(", ")}`);
  }
  await page.keyboard.press("Escape");
  if (await answersDialog.isVisible().catch(() => false)) throw new Error("Escape did not close the Answers contribution dialog.");

  await page.goBack();
  await expectVisible(page.getByText("Get started"), "Browser Back did not clear the selected error.");
  await page.goForward();
  await expectVisible(page.getByText("Resolution Paths"), "Browser Forward did not restore the selected error.");
  await expectVisible(page.getByText("Source Confidence", { exact: true }), "Compact Source Confidence field was not visible.");
  await expectVisible(page.getByText("All Reviewed Sources", { exact: false }), "Collapsed reviewed-source section was not visible.");
  if (await page.locator(".detail-sidebar").count()) throw new Error("Legacy detail sidebar is still rendered.");
  await expectVisible(page.locator(".resolution-path.open .path-evidence-row").first(), "The open resolution path did not show linked evidence.");
  const selectedDetailAccessibility = await new AxeBuilder({ page }).include(".detail-pane").analyze();
  const seriousSelectedDetailIssues = selectedDetailAccessibility.violations.filter((issue) => ["serious", "critical"].includes(issue.impact));
  if (seriousSelectedDetailIssues.length) {
    throw new Error(`Selected detail accessibility violations: ${seriousSelectedDetailIssues.flatMap((issue) => issue.nodes.map((node) => `${issue.id} (${node.target.join(" ")})`)).join(", ")}`);
  }

  await page.getByLabel("Product", { exact: true }).selectOption("Forms");
  await expectVisible(page.getByText("Get started"), "Filtering out the selected entry did not clear the detail pane.");

  await expectVisible(page.getByText("Reviewed Source Ledger"), "Reviewed Source Ledger was not visible.");
  await page.getByRole("button", { name: "View full ledger" }).click();
  await expectVisible(page.getByRole("navigation", { name: "Reviewed source pages" }), "Ledger pagination was not visible.");
  const visibleLedgerRows = await page.locator(".ledger-row:not(.ledger-head)").count();
  if (visibleLedgerRows > 50) throw new Error(`Ledger rendered ${visibleLedgerRows} rows on one page.`);
  const faviconStatus = await page.evaluate(() =>
    fetch("/FicheBaitErrorHelper/favicon.ico").then((response) => response.status),
  );
  if (faviconStatus !== 200) throw new Error(`Favicon returned HTTP ${faviconStatus}.`);
  await page.goto(`${baseUrl}?error=lf-server-9030-session-license-limit`, { waitUntil: "networkidle" });
  await expectVisible(page.getByText("Resolution Paths"), "Direct error link did not hydrate its product detail module.");
  await page.goto(`${baseUrl}?q=lff-706&error=forms-lff706-routing-endpoint`, { waitUntil: "networkidle" });
  await expectVisible(page.getByRole("heading", { name: "LFF706" }), "Legacy merged-entry link did not open the canonical LFF706 entry.");
  await page.waitForURL(/error=forms-lff706-unable-to-trigger-routing/);
  if ((await page.locator(".resolution-path").count()) !== 4) {
    throw new Error("Merged LFF706 entry did not render its three source-specific scenarios and general checklist.");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBack = page.getByRole("button", { name: "Back to results" });
  await expectVisible(mobileBack, "Mobile error detail did not provide a Back to results action.");
  await mobileBack.click();
  await expectVisible(page.getByLabel("Error results"), "Back to results did not restore mobile results.");
  await page.getByText("Reviewed Source Ledger").scrollIntoViewIfNeeded();
  const ledgerWidth = await page.locator(".ledger-panel").evaluate((element) => element.getBoundingClientRect().width);
  if (ledgerWidth > 390) throw new Error(`Mobile ledger exceeds the viewport: ${ledgerWidth}px.`);
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await browser.close();
  browser = null;

  if (mobileOverflow) throw new Error("Mobile viewport has horizontal overflow.");
  if (consoleErrors.length > 0) throw new Error(`Console errors: ${consoleErrors.join("; ")}`);
  console.log(`Smoke check passed: ${baseUrl}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

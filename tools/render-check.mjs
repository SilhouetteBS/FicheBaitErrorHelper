import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { browserLaunchOptions } from "./browser-launch.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopScreenshot = resolve(rootDir, "dist", "render-check.png");
const answersDialogScreenshot = resolve(rootDir, "dist", "render-check-answers-dialog.png");
const longTitleScreenshot = resolve(rootDir, "dist", "render-check-long-title.png");
const mobileScreenshot = resolve(rootDir, "dist", "render-check-mobile.png");
const mobileAnswersDialogScreenshot = resolve(rootDir, "dist", "render-check-mobile-answers-dialog.png");
const longTitleEntryId =
  "support-promoted-1014518-forms-forms-improving-performance-in-laserfich-improving-performance-in-laserfiche-forms-versions-10-3-1-onward";
let server;
let browser;

try {
  server = await preview({
    preview: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
  });
  const address = server.httpServer.address();
  const url = `http://127.0.0.1:${address.port}/FicheBaitErrorHelper/`;
  browser = await chromium.launch(browserLaunchOptions());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const firstVisitInstructionsVisible = await page.getByText("Get started").isVisible();
  if (!firstVisitInstructionsVisible) throw new Error("First visit did not show the instructions pane.");
  await page.getByPlaceholder("Search code, message, symptom, product, or fix").fill("9030");
  await page.waitForURL(/q=9030/);
  const resultGroup = page.getByRole("button", { name: /Laserfiche Server\/Repository Server/ });
  if ((await resultGroup.getAttribute("aria-expanded")) !== "true") await resultGroup.click();
  await page.getByRole("button", { name: /9030 Maximum sessions or licensing limit reached/ }).click();
  await page.waitForURL(/error=/);
  await page.getByText("Likely Fixes").waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: desktopScreenshot, fullPage: false });
  const visible = await page.getByText("Likely Fixes").isVisible();
  await page.getByRole("button", { name: "Contribute on Answers", exact: true }).click();
  const answersDialog = page.getByRole("dialog", { name: "Share a troubleshooting outcome" });
  await answersDialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: answersDialogScreenshot, fullPage: false });
  const desktopDialogOverflow = await answersDialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left < 0 || bounds.top < 0 || bounds.right > window.innerWidth || bounds.bottom > window.innerHeight;
  });
  await page.keyboard.press("Escape");
  await page.goto(`${url}?error=${longTitleEntryId}`, { waitUntil: "networkidle" });
  const longTitle = page.getByRole("heading", { name: "FORMS-IMPROVING_PERFORMANCE_IN_LASERFICH" });
  await longTitle.waitFor({ state: "visible", timeout: 10_000 });
  const desktopLongTitleOverflow = await page.evaluate(() => {
    const title = document.querySelector(".detail-header h2")?.getBoundingClientRect();
    const main = document.querySelector(".detail-main")?.getBoundingClientRect();
    return !title || !main || title.right > main.right + 0.5 || document.documentElement.scrollWidth > window.innerWidth;
  });
  const desktopPaneScroll = await page.evaluate(async () => {
    const results = document.querySelector(".results-pane");
    const detail = document.querySelector(".detail-pane");
    if (!results || !detail) return { valid: false };
    const detailTop = detail.getBoundingClientRect().top;
    const pageScrollTop = window.scrollY;
    results.scrollTop = Math.min(600, results.scrollHeight - results.clientHeight);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      valid: results.scrollHeight > results.clientHeight && results.scrollTop > 0,
      detailStayedAligned: Math.abs(detail.getBoundingClientRect().top - detailTop) < 0.5,
      pageStayedPut: window.scrollY === pageScrollTop,
    };
  });
  await page.screenshot({ path: longTitleScreenshot, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Back to results" }).waitFor({ state: "visible" });
  await page.screenshot({ path: mobileScreenshot, fullPage: false });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.goto(`${url}?error=lf-server-9030-session-license-limit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Contribute on Answers", exact: true }).click();
  const mobileAnswersDialog = page.getByRole("dialog", { name: "Share a troubleshooting outcome" });
  await mobileAnswersDialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: mobileAnswersDialogScreenshot, fullPage: false });
  const mobileDialogOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await browser.close();
  browser = null;
  if (!visible) throw new Error("Detail pane did not render expected troubleshooting section.");
  if (desktopDialogOverflow) throw new Error("Answers contribution dialog exceeds the desktop viewport.");
  if (desktopLongTitleOverflow) throw new Error("Long error title overflows the desktop detail column.");
  if (!desktopPaneScroll.valid || !desktopPaneScroll.detailStayedAligned || !desktopPaneScroll.pageStayedPut) {
    throw new Error("Desktop result scrolling does not keep the detail pane aligned.");
  }
  if (mobileOverflow) throw new Error("Mobile viewport has horizontal overflow.");
  if (mobileDialogOverflow) throw new Error("Answers contribution dialog causes mobile horizontal overflow.");
  if (!existsSync(desktopScreenshot) || !existsSync(answersDialogScreenshot) || !existsSync(longTitleScreenshot) || !existsSync(mobileScreenshot) || !existsSync(mobileAnswersDialogScreenshot)) {
    throw new Error("Render check screenshots were not written.");
  }
  if (consoleErrors.length > 0) throw new Error(`Console errors: ${consoleErrors.join("; ")}`);
  console.log(`Render check passed: ${url}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) {
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}

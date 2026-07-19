import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { browserLaunchOptions } from "./browser-launch.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopScreenshot = resolve(rootDir, "dist", "render-check.png");
const mobileScreenshot = resolve(rootDir, "dist", "render-check-mobile.png");
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
  await page.getByRole("button", { name: /Laserfiche Server\/Repository Server/ }).click();
  await page.getByRole("button", { name: /9030 Maximum sessions or licensing limit reached/ }).click();
  await page.waitForURL(/error=/);
  await page.getByText("Likely Fixes").waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({ path: desktopScreenshot, fullPage: false });
  const visible = await page.getByText("Likely Fixes").isVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: mobileScreenshot, fullPage: false });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await browser.close();
  browser = null;
  if (!visible) throw new Error("Detail pane did not render expected troubleshooting section.");
  if (mobileOverflow) throw new Error("Mobile viewport has horizontal overflow.");
  if (!existsSync(desktopScreenshot) || !existsSync(mobileScreenshot)) {
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

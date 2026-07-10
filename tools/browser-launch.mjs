import { existsSync } from "node:fs";

const windowsChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export function browserLaunchOptions() {
  const configuredPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (configuredPath) return { executablePath: configuredPath };
  if (process.platform === "win32" && existsSync(windowsChromePath)) {
    return { executablePath: windowsChromePath };
  }
  return {};
}

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";

function runGenerator() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["tools/generate-published-catalog.mjs"], { stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(output)));
  });
}

test("catalog generation is safe when two commands overlap", async () => {
  await Promise.all([runGenerator(), runGenerator()]);
  assert.equal(fs.existsSync("src/data/generated/catalogManifest.js"), true);
  assert.equal(fs.existsSync("src/data/.catalog-generation.lock"), false);
});

test("the initial catalog index stays within its payload budget", () => {
  const bytes = fs.statSync("src/data/generated/catalogIndex.js").size;
  assert.ok(bytes < 2_500_000, `catalogIndex.js is ${bytes} bytes`);
});

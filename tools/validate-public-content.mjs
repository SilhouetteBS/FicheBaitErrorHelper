import fs from "node:fs";

const allowedResearchFiles = new Set([
  "research/README.md",
  "research/needs-review-report.md",
  "research/progress-report.md",
  "research/quality-report.md",
  "research/support-chrome-search-index.md",
  "research/support-kb-research-status.md",
]);
if (process.env.CI) {
  const publicResearchFiles = fs.readdirSync("research", { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `research/${entry.name}`);
  const unexpectedFiles = publicResearchFiles.filter((file) => !allowedResearchFiles.has(file));
  if (unexpectedFiles.length) {
    console.error(`Raw research files must not be public:\n${unexpectedFiles.join("\n")}`);
    process.exit(1);
  }
} else {
  const gitignore = fs.readFileSync(".gitignore", "utf8");
  if (!gitignore.includes("research/*")) {
    console.error(".gitignore must exclude raw research artifacts.");
    process.exit(1);
  }
}

for (const requiredFile of ["CONTENT-NOTICE.md", "LICENSE", "SECURITY.md"]) {
  if (!fs.existsSync(requiredFile)) {
    console.error(`Missing required public-policy file: ${requiredFile}`);
    process.exit(1);
  }
}

console.log(`Validated the ${allowedResearchFiles.size}-file public research allowlist.`);

import fs from "node:fs/promises";

const sourceUrl =
  "https://doc.laserfiche.com/laserfiche.documentation/12/userguide/en-us/content/support-error-codes.htm?tocpath=Laserfiche%20User%20Guide%7CSupport%252C%20Monitoring%252C%20and%20Troubleshooting%7CError%20Codes%7C_____0";
const outputPath = new URL("../src/data/officialDocumentationErrors.js", import.meta.url);

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#160;/g, " ");
}

function textFromHtml(value) {
  return asciiText(decodeHtml(value.replace(/<[^>]*>/g, " ")))
    .replace(/\s+/g, " ")
    .trim();
}

function asciiText(value) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ");
}

function sentence(value) {
  return value.replace(/[.?!]+$/g, "");
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function numberFromCode(code) {
  return Number.parseInt(code, 10);
}

function productFor(section, code) {
  const number = numberFromCode(code);

  if (section === "Common Dialog Errors" || (number >= 2500 && number <= 2599)) {
    return "Common Dialog";
  }

  if (/Workflow/i.test(section)) {
    return "Workflow";
  }

  if ((number >= 700 && number <= 1500) || (number >= 9000 && number <= 10099)) {
    return "Laserfiche Server/Repository Server";
  }

  if (number >= 5100 && number <= 6999) {
    return "Windows Client/Desktop Client";
  }

  return "Laserfiche Server/Repository Server";
}

function fixHints(description) {
  const text = description.toLowerCase();
  const fixes = [];

  if (/access|permission|right|security|denied/.test(text)) {
    fixes.push("Verify the user's repository rights, feature rights, security tags, and volume permissions.");
  }
  if (/password|account|login|log in|credential|user name|username/.test(text)) {
    fixes.push("Verify the username, password, account status, and authentication source.");
  }
  if (/database|sql|dbms|repository information/.test(text)) {
    fixes.push("Check SQL Server connectivity, repository event logs, and the Laserfiche Server service account.");
  }
  if (/volume|mount/.test(text)) {
    fixes.push("Confirm the target volume exists, is mounted, and is writable when the operation requires writes.");
  }
  if (/locked|lock/.test(text)) {
    fixes.push("Identify the user or process holding the lock, wait for it to complete, or clear the lock administratively.");
  }
  if (/path|file|directory|folder/.test(text)) {
    fixes.push("Verify the path, file, or folder exists and that the service account can access it.");
  }
  if (/space|memory|resource|limit|maximum/.test(text)) {
    fixes.push("Check server resources, configured product limits, licensing limits, and available disk space.");
  }
  if (/not found|missing|does not exist|invalid/.test(text)) {
    fixes.push("Confirm the referenced repository object, setting, or identifier exists and is valid.");
  }

  fixes.push("Review the linked official Laserfiche documentation for any code-specific resolution text.");
  fixes.push("Search Laserfiche Answers for the exact code before treating this as a confirmed fix.");

  return Array.from(new Set(fixes)).slice(0, 5);
}

async function main() {
  const html = await fetch(sourceUrl).then((response) => {
    if (!response.ok) throw new Error(`Failed to fetch official docs: ${response.status}`);
    return response.text();
  });

  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  let section = "Laserfiche Client and Repository Errors";
  const entries = [];

  for (const rowMatch of rows) {
    const row = rowMatch[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => match[1]);

    if (cells.length === 1) {
      const heading = textFromHtml(cells[0]);
      if (heading && !/^Error Code Range/i.test(heading)) section = heading;
      continue;
    }

    if (cells.length < 2) continue;

    const code = textFromHtml(cells[0]);
    const description = textFromHtml(cells[1]);
    if (!/^\d{3,5}$/.test(code) || !description || /^Error Description$/i.test(description)) continue;

    const normalizedSection = section === "Unknown" ? "Laserfiche Client and Repository Errors" : section;
    entries.push({
      id: `official-lf12-${code}-${slug(description)}`,
      code,
      message: description,
      product: productFor(normalizedSection, code),
      versions: ["Version 12"],
      confidence: "low",
      reviewedDate: new Date().toISOString().slice(0, 10),
      summary: `Official Laserfiche documentation lists ${code} as: ${sentence(description)}.`,
      symptoms: [
        `Laserfiche reports ${sentence(description)}. [${code}].`,
        `This code appears in the ${normalizedSection} section of the official Laserfiche 12 error-code listing.`,
      ],
      likelyFixes: fixHints(description),
      notes:
        "Generated from the official Laserfiche 12 error-code listing. This entry needs Answers review before community or employee fixes are promoted.",
      sources: [
        {
          sourceType: "official-docs",
          title: "Laserfiche 12 User Guide: Error Codes",
          url: sourceUrl,
          note: `Lists ${code} as ${sentence(description)}.`,
        },
      ],
    });
  }

  entries.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const file = `// Generated by tools/generate-official-doc-data.mjs from the official Laserfiche 12 error-code listing.\n` +
    `// Hand-curated entries in errors.js take precedence over generated entries with the same code.\n` +
    `export const officialDocumentationErrorEntries = ${JSON.stringify(entries, null, 2)};\n`;

  await fs.writeFile(outputPath, file);
  console.log(`Wrote ${entries.length} official documentation error entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

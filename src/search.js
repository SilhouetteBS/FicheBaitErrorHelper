import { productAliases } from "./data/catalogMetadata.js";

const fixStatusLabels = {
  "known-fix": "Known fix",
  workaround: "Workaround",
  "diagnostic-only": "Diagnostic only",
  unresolved: "Unresolved",
  "needs-review": "Needs review",
};

export function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function normalizeCode(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function isSubsequence(needle, haystack) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

export function entrySearchText(entry) {
  if (entry.searchText) return entry.searchText;
  return [
    entry.code,
    entry.message,
    entry.product,
    ...(productAliases[entry.product] ?? []),
    entry.summary,
    ...(entry.symptoms ?? []),
    ...(entry.likelyFixes ?? []),
    ...(entry.versions ?? []),
    ...(entry.scenarios ?? []).flatMap((scenario) => [
      scenario.title,
      scenario.summary,
      ...(scenario.versions ?? []),
      ...(scenario.symptoms ?? []),
      ...(scenario.causes ?? []),
      ...(scenario.fixes ?? []),
    ]),
    fixStatusLabels[entry.fixStatus] ?? entry.fixStatus,
    ...(entry.sources ?? []).map((item) => item.title),
  ]
    .filter(Boolean)
    .join(" ");
}

export function searchScore(entry, rawTerm) {
  const term = normalize(rawTerm);
  if (!term) return 1;

  const haystack = normalize(entrySearchText(entry));
  const code = normalizeCode(entry.code);
  const requestedCode = normalizeCode(term);
  let score = 0;

  if (requestedCode && code === requestedCode) score += 1000;
  else if (requestedCode && code.includes(requestedCode)) score += 650;

  if (normalize(entry.message).includes(term)) score += 250;
  if (normalize(entry.summary).includes(term)) score += 140;
  if (normalize(entry.product).includes(term)) score += 90;
  if (haystack.includes(term)) score += 80;

  const tokens = tokenize(term);
  if (tokens.length) {
    const matchedTokens = tokens.filter((token) => haystack.includes(token));
    if (matchedTokens.length === tokens.length) score += matchedTokens.length * 45;
    else if (matchedTokens.length) score += matchedTokens.length * 12;

    const fuzzyTokens = tokens.filter(
      (token) => token.length > 3 && /[a-z]/i.test(token) && isSubsequence(token, haystack),
    );
    if (matchedTokens.length + fuzzyTokens.length >= tokens.length) score += fuzzyTokens.length * 8;
  }

  return score;
}

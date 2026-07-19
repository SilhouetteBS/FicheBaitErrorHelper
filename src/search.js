import { productAliases } from "./data/catalogMetadata.js";
import { fixStatusMetadata, statusLabel } from "./statusMetadata.js";

export function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function normalizeCode(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function editDistanceWithin(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      const value = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, substitution);
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > limit) return false;
    previous = current;
  }
  return previous[right.length] <= limit;
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
    statusLabel(fixStatusMetadata, entry.fixStatus),
    ...(entry.sources ?? []).map((item) => item.title),
  ]
    .filter(Boolean)
    .join(" ");
}

export function searchScore(entry, rawTerm) {
  const term = normalize(rawTerm);
  if (!term) return 1;

  const haystack = normalize(entrySearchText(entry));
  const haystackTokens = new Set(tokenize(haystack));
  const code = normalizeCode(entry.code);
  const requestedCode = normalizeCode(term);
  const isCodeOnlyQuery = /\d/.test(term) && !/\s/.test(term) && /^[a-z0-9_.:-]+$/.test(term);
  let score = 0;

  if (requestedCode && code === requestedCode) score += 1000;
  else if (requestedCode && code.includes(requestedCode)) score += 650;
  else if (isCodeOnlyQuery) return 0;

  if (normalize(entry.message).includes(term)) score += 250;
  if (normalize(entry.summary).includes(term)) score += 140;
  if (normalize(entry.product).includes(term)) score += 90;
  if (haystack.includes(term)) score += 80;

  const tokens = tokenize(term);
  if (tokens.length) {
    const matchedTokens = tokens.filter((token) => haystackTokens.has(token));
    if (matchedTokens.length === tokens.length) score += matchedTokens.length * 45;
    else if (matchedTokens.length) score += matchedTokens.length * 12;

    const fuzzyTokens = tokens.filter((token) => {
      if (token.length < 4 || !/[a-z]/i.test(token) || haystackTokens.has(token)) return false;
      const limit = token.length >= 8 ? 2 : 1;
      return [...haystackTokens].some((candidate) => editDistanceWithin(token, candidate, limit));
    });
    if (matchedTokens.length + fuzzyTokens.length >= tokens.length) score += fuzzyTokens.length * 8;
  }

  return score;
}

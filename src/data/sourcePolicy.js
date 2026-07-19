export const allowedSourceHosts = Object.freeze({
  "official-docs": ["doc.laserfiche.com"],
  "support-knowledge-base": ["support.laserfiche.com"],
  "answers-community": ["answers.laserfiche.com"],
  "answers-community-confirmed": ["answers.laserfiche.com"],
  "answers-laserfiche-employee": ["answers.laserfiche.com"],
  "answers-search": ["answers.laserfiche.com"],
});

export function validateSourceUrl(sourceType, rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "URL is invalid" };
  }

  if (url.protocol !== "https:") return { valid: false, reason: "URL must use HTTPS" };
  const hosts = allowedSourceHosts[sourceType];
  if (!hosts) return { valid: false, reason: `Source type ${sourceType} has no trusted-host policy` };
  if (!hosts.includes(url.hostname.toLowerCase())) {
    return { valid: false, reason: `${url.hostname} is not allowed for ${sourceType}` };
  }
  const sensitiveParameter = [...url.searchParams.keys()].find((name) => /(token|password|secret|session|auth|signature|api[-_]?key)/i.test(name));
  if (sensitiveParameter) return { valid: false, reason: `URL contains sensitive parameter ${sensitiveParameter}` };
  return { valid: true, url };
}

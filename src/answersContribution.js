export const answersOutcomeOptions = [
  { value: "resolved", label: "Resolved the issue" },
  { value: "not-resolved", label: "Did not resolve the issue" },
  { value: "partially-helped", label: "Partially helped" },
  { value: "another-cause", label: "Found another cause" },
  { value: "another-fix", label: "Found another fix" },
];

export function isAnswersUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "answers.laserfiche.com";
  } catch {
    return false;
  }
}

export function answersOutcomeLabel(value) {
  return answersOutcomeOptions.find((option) => option.value === value)?.label ?? value;
}

export function buildAnswersReply({ entry, source, scenario, outcome, versionBuild, context }) {
  const lines = [
    `Product: ${entry.product}`,
    `Version/build: ${versionBuild.trim()}`,
    `Error: ${entry.code} - ${entry.message}`,
    `Scenario or source reviewed: ${scenario?.title ?? source.title}`,
    `Outcome: ${answersOutcomeLabel(outcome)}`,
  ];

  const trimmedContext = context.trim();
  if (trimmedContext) lines.push(`Additional relevant details: ${trimmedContext}`);
  return lines.join("\n");
}

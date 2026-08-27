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

export function answersContributionTargets(entry) {
  const targets = [];
  const scenarioUrls = new Set();
  const targetKeys = new Set();

  for (const scenario of entry.scenarios ?? []) {
    for (const url of scenario.sourceUrls ?? []) {
      if (!isAnswersUrl(url)) continue;
      const source = entry.sources.find((candidate) => candidate.url === url) ?? { title: url, url };
      const key = `${url}|${scenario.title}`;
      if (targetKeys.has(key)) continue;
      targetKeys.add(key);
      scenarioUrls.add(url);
      targets.push({ source, scenario });
    }
  }

  for (const source of entry.sources) {
    if (!isAnswersUrl(source.url) || scenarioUrls.has(source.url)) continue;
    targets.push({ source, scenario: null });
  }

  return targets;
}

export function answersTargetLabel(target) {
  return target.scenario ? `${target.scenario.title} - ${target.source.title}` : target.source.title;
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

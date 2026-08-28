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

function answersOutcomeSentence(value) {
  const sentences = {
    resolved: "This resolved the issue in my environment.",
    "not-resolved": "This did not resolve the issue in my environment.",
    "partially-helped": "This partially helped in my environment, but additional troubleshooting was still required.",
    "another-cause": "I found that the issue had a different cause in my environment.",
    "another-fix": "I resolved the issue in my environment, but with a different fix.",
  };
  return sentences[value] ?? `My result was: ${answersOutcomeLabel(value)}.`;
}

export function buildAnswersReply({ entry, source, scenario, outcome, versionBuild, context }) {
  const version = versionBuild.trim() || "version/build not specified";
  const paragraphs = [
    `I tested this while troubleshooting ${entry.code} - ${entry.message} in ${entry.product} (${version}).`,
    scenario
      ? `The troubleshooting context matched "${scenario.title}". ${answersOutcomeSentence(outcome)}`
      : `I followed the guidance in "${source.title}". ${answersOutcomeSentence(outcome)}`,
  ];

  const trimmedContext = context.trim();
  if (trimmedContext) paragraphs.push(`Here are the additional details from my testing:\n${trimmedContext}`);
  paragraphs.push("I hope this context helps others investigating the same error.");
  return paragraphs.join("\n\n");
}

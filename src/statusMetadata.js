export const fixStatusMetadata = {
  "known-fix": { label: "Known fix" },
  workaround: { label: "Workaround" },
  "diagnostic-only": { label: "Diagnostic only" },
  unresolved: { label: "Unresolved" },
  "needs-review": { label: "Needs review" },
};

export const validationStatusMetadata = {
  "official-doc-baseline": {
    label: "Official doc baseline",
    description: "This error is listed in official documentation, but no public Answers fix has been attached yet.",
  },
  "reviewed-diagnostic": {
    label: "Reviewed diagnostic",
    description: "Current sources were reviewed; keep this as diagnostic guidance unless stronger evidence is found.",
  },
  "source-research-needed": {
    label: "Needs source research",
    description: "The entry is documented for discovery, but it still needs deeper source research before promoting a fix.",
  },
};

export const reviewStatusMetadata = {
  curated: { label: "Curated" },
  "curated-partial": { label: "Curated partial" },
  "curated-unresolved": { label: "Curated unresolved" },
  candidate: { label: "Candidate" },
  "cross-product": { label: "Cross-product" },
  "not-actionable": { label: "Not actionable" },
  "no-matching-posts": { label: "No matching posts" },
};

export function statusLabel(metadata, value, fallback = value) {
  return metadata[value]?.label ?? fallback;
}

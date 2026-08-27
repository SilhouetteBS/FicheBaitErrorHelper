# Community Workflow

## How Users Should Contribute

1. Search the live helper for the error code or message.
2. For an Answers-backed entry, use `Contribute on Answers` to select the relevant source or scenario, generate a structured reply, and open the original discussion.
3. Include the product, exact version/build, outcome, and relevant sanitized context in the Answers reply.
4. Use `Report Correction` for incorrect Error Helper metadata, an Answers post that cannot accept replies, or an entry without a relevant Answers discussion.
5. Remove private data, credentials, hostnames, repository names, license details, and customer-identifying information.
6. Do not open a pull request unless a maintainer asks for one.

Answers replies are community evidence, not direct catalog edits. Maintainers review new and updated replies before changing source confidence, fix status, validation status, version applicability, or scenario guidance.

## Maintainer Review

Maintainers should classify submissions into one of these outcomes:

- Accepted fix: source supports a known fix.
- Accepted workaround: source supports a workaround but not a permanent fix.
- Accepted diagnostic: source helps identify or troubleshoot the error but does not prove a fix.
- Scenario needed: source describes another cause or remediation path for an existing code.
- Rejected cross-product: source belongs to a different product context.
- Rejected low-signal: source does not add actionable evidence.

## Issue Labels

Use these labels to track issue-only community contributions:

- `needs-review`
- `source-review`
- `accepted-source`
- `needs-more-info`
- `duplicate`
- `not-actionable`
- `curated`
- `privacy-risk`

## Source Promotion Rules

Promote a fix only when the source supports:

- Product context.
- Version context, when available.
- Observable symptom.
- Cause or diagnostic branch.
- Fix, workaround, or next step.
- Source authority.

When the same code has multiple causes, add a scenario instead of replacing the existing guidance.

Community reports that a fix worked can corroborate a scenario. Reports that a fix did not work should trigger scenario review rather than automatically invalidating the existing fix.

## Privacy Rules

Public issues must not include credentials, license files, customer names, server names, repository names, private URLs, or full logs with identifying data.

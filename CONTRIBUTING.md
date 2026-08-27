# Contributing

Thank you for helping improve the FicheBait Error Helper.

## Contribution Model

Troubleshooting outcomes should be shared on the linked Laserfiche Answers discussion so the wider Laserfiche community can review and benefit from them. Answers-backed entries provide a prominent `Contribute on Answers` action that creates a structured response for the contributor to post.

GitHub Issues are the fallback for incorrect Error Helper metadata, locked Answers posts, missing discussions, and source-ledger corrections. Public contributions should not be submitted as pull requests.

Maintainers make the actual catalog, source-ledger, and code changes after reviewing submitted evidence. This keeps troubleshooting guidance consistent, source-backed, and auditable.

Answers replies and GitHub reports do not directly change source confidence, fix status, validation status, version applicability, or published troubleshooting guidance.

## Use These Issue Templates

- `Report an error entry`: incorrect product, version, code, message, symptom, or missing entry.
- `Suggest a fix source`: official documentation or Laserfiche Answers source that supports a fix, workaround, diagnostic step, or scenario.
- `Correct a source`: broken link, wrong source type, duplicate source, or source metadata correction.

Do not open a duplicate GitHub Issue when the relevant evidence can be added to an active Answers discussion.

## What To Include

- Exact error code or message.
- Laserfiche product.
- Laserfiche version, if known.
- Where the error appeared.
- Source links, preferably official docs or Laserfiche Answers.
- Suggested correction.
- Confirmation that private data was removed.

Do not include credentials, license details, repository names, server names, customer names, private URLs, screenshots with sensitive data, or full logs with identifying information.

## Evidence Standards

Every new or promoted fix needs source evidence. Preferred source order:

1. Official Laserfiche documentation.
2. Laserfiche Answers replies from Laserfiche employees.
3. Accepted or corroborated Laserfiche Answers community replies.
4. Community-only diagnostic reports.

Maintainers will not mark an entry as `known-fix` or `workaround` unless the source supports the product, version when available, symptom, and remediation.

## Pull Requests

Unrequested pull requests are not accepted for catalog edits, source-ledger edits, or troubleshooting guidance.

A maintainer may request a pull request for narrow project-maintenance work, such as documentation cleanup, tests, or tooling. If a maintainer did not ask for the pull request, please open an issue instead.

## Maintainer Workflow

Maintainers review issues, classify the evidence, make the curated repo change, run launch checks, and close the issue with the commit or release reference.

Useful labels:

- `needs-review`
- `source-review`
- `accepted-source`
- `needs-more-info`
- `duplicate`
- `not-actionable`
- `curated`
- `privacy-risk`

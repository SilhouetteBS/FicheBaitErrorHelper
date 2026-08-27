# FicheBait Error Helper

Interactive GitHub Pages app for browsing error codes, symptoms, source links, and curated troubleshooting guidance for self-hosted Laserfiche® software environments.

Live site: https://silhouettebs.github.io/FicheBaitErrorHelper/

This project is not affiliated with or endorsed by Laserfiche. It is a community research aid, not a replacement for Laserfiche Support, vendor documentation, or environment-specific change control.

Laserfiche is a registered trademark of Compulink Management Center, Inc. Use of the mark follows the
[Laserfiche trademark and brand guidelines](https://www.laserfiche.com/legal/trademark/).

The MIT license applies to original software code only. See `CONTENT-NOTICE.md` for catalog and third-party content
rights, attribution, and research-data handling.

## What It Does

- Searches official Laserfiche documentation entries and reviewed Laserfiche Answers sources.
- Groups errors by product and shows version context when available.
- Labels source confidence, fix status, validation status, and source priority.
- Keeps diagnostic-only and official-doc baseline entries visible for discovery.
- Links every entry back to reviewed sources.
- Supports correction reports through GitHub issue templates.

## Current Launch Snapshot

Current entry, source, fix-status, product-coverage, and scenario counts are generated in
`research/progress-report.md` and `research/quality-report.md`. The application calculates its displayed totals directly
from the published catalog so documentation snapshots do not drift from the live data.

See `docs/known-limitations.md` for the current limitations and safety notes.

## How To Use It Safely

1. Search by error code, message text, product, symptom, or source detail.
2. Check the product, version, source confidence, fix status, and validation status.
3. Open the linked source before applying a fix.
4. Validate changes in a test or maintenance window before changing production.
5. Treat database, IIS, certificate, service-account, and security-baseline changes as change-controlled work.

## Source Priority

1. Official Laserfiche documentation.
2. Laserfiche Answers replies from Laserfiche employees.
3. Accepted or corroborated Laserfiche Answers community replies.
4. Community-only diagnostic reports.

## Contribution Paths

- Share version-specific troubleshooting outcomes through the linked Laserfiche Answers discussion using `Contribute on Answers`.
- Report an incorrect or missing error entry with the `Report an error entry` issue template.
- Suggest a source-backed fix with the `Suggest a fix source` issue template.
- Correct source metadata with the `Correct a source` issue template.
- Do not open pull requests for catalog or troubleshooting changes unless a maintainer asks for one.

Read `CONTRIBUTING.md` before submitting changes.

## Development

```powershell
npm install
npm run lint:data
npm run quality
npm run progress
npm run build
npm run smoke
npm run render:check
npm run dev
```

## Research and Quality Commands

- `npm run progress` updates the broad research coverage report.
- `npm run housekeeping` refreshes Support KB indexes and current research workspace summaries.
- `npm run quality` updates `research/quality-report.md`.
- `npm run validation:batches` updates the validation batch reports.
- `npm run curation:priority` reviews priority-source candidates.
- `npm run curation:community` reviews community-confirmed fix candidates.
- `npm run validation:complete` records validation outcomes.
- `npm run backlog:research` re-searches source-research backlog entries.
- `npm run backlog:curate` attaches official-doc backlog matches and writes candidate review output.
- `npm run collect:answers -- "Product Name" 25` runs a bounded product-specific discovery pass.
- `npm run verify:launch` runs the launch-readiness command set.
- `npm test` runs focused search and catalog-integrity regression tests.

## Important Docs

- `docs/research-workflow.md`
- `docs/release-process.md`
- `docs/known-limitations.md`
- `docs/community-workflow.md`
- `docs/maintenance-plan.md`
- `docs/data-quality-roadmap.md`
- `docs/product-aliases.md`
- `docs/product-catalog-splitting.md`
- `docs/launch-announcement.md`

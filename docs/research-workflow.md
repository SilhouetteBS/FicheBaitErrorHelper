# Research Workflow

This project publishes curated troubleshooting entries and sanitized aggregate reports only. Raw or partially reviewed
research must stay in the private `SilhouetteBS/FicheBaitErrorHelperResearch` repository until it has enough evidence
for a sanitized promotion into `src/data/errors.js`.

Set `FICHEBAIT_RESEARCH_DIR` to the private repository's `research` directory when running discovery and curation
commands. Never copy authenticated page bodies, raw snippets, credentials, customer identifiers, or full logs into the
public repository.

## Source Priority

1. Official Laserfiche documentation.
2. Laserfiche Answers replies from Laserfiche employees.
3. Accepted or corroborated Laserfiche Answers community replies.
4. Unverified community reports.

## Review Checklist

For each source reviewed, record:

- URL
- title
- source type
- reviewed date
- product tags
- extracted error codes
- review status
- short notes

When adding a published error entry, include product, versions, symptoms, likely fixes, source links, confidence, and uncertainty notes. Do not publish a fix as high confidence unless the source clearly supports it.

## Multiple Scenarios for One Error

Some Laserfiche errors have more than one cause or fix path. Keep those cases on one entry and use the `scenarios` array when:

- the same code appears in different products or modules
- the same message has different causes by version
- official documentation identifies the code but Answers posts identify product-specific fixes
- community and employee replies describe different but plausible remediation paths

Each scenario should name the symptom, likely cause, fix or next step, version context, and source URLs that support that specific scenario.

## Validation Queue

Run `npm run quality` to generate `research/quality-report.md`. Use the report to prioritize:

1. low-confidence entries with official documentation or employee replies
2. diagnostic-only entries that have enough source context to become a known fix or workaround
3. unresolved entries that need another Answers/documentation pass
4. message-only entries that should be merged into an existing code entry as a scenario

Run `npm run validation:batches` to triage the full validation queue in batches of 50. The generated ledger records each candidate, its batch, a disposition, and the next review step. Treat the ledger as a planning artifact: it proves every candidate was triaged, but it does not by itself justify promoting a fix.

Run `npm run curation:priority` after refreshing validation batches to review priority-source candidates. The command writes `research/priority-source-curation.md`, exports the source candidate set, and updates `src/data/curationOverrides.js` with conservative fix-status promotions.

Run `npm run curation:community` after priority curation to review `Answers - Community Confirmed` candidates. This pass is lower priority than employee-source review and promotes only when the captured notes explicitly support a fix, workaround, or accepted remediation.

Run `npm run validation:complete` when the current validation batches have been triaged. This records whether each row is an official-doc baseline, reviewed diagnostic entry, or still needs source research, then moves unresolved research needs into `research/source-research-backlog.md`.

Run `npm run backlog:research` to re-check the `source-research-needed` entries against Laserfiche Answers search results and the imported official documentation catalog. Review the JSON pass output before promoting any new candidate source into the public catalog.

Run `npm run backlog:curate` after a backlog research pass. It attaches exact official-documentation matches as baseline sources and writes the Answers candidate review report without promoting unreviewed posts.

Run `npm run review:candidate -- "<answers-url>" <disposition> "note"` to mark a candidate as `accepted-fix`, `accepted-diagnostic`, `rejected-low-signal`, `rejected-cross-product`, or `pending`. Accepted source-backed fixes still need a matching curated promotion in `src/data/sourceCandidateReviews.js` before the public app should show a stronger fix status.

Run `npm run collect:answers -- "Product Name" 25` for a bounded product-specific Laserfiche Answers discovery pass. Products with no new candidates should still keep the generated pass file as evidence of the search.

## Product-Specific Discovery

The official Version 12 server-code pass is tracked separately in `research/answers-search-results.json` and `research/answers-reviewed-summary.json`.

Use `research/product-discovery-queue.json` for product-specific discovery outside the official server-code listing. Each queue item contains official documentation searches and Laserfiche Answers searches for one product.

Use `product-discovery-results.json` in the private research workspace for candidate signatures found during product discovery. A signature can be:

- a numeric error code, such as `9357`
- an exact UI or log message with no numeric code
- an exception class or subsystem message
- a synthetic identifier for a recurring message-only issue, such as `FORMS-AUTH-001`

Before publishing a product-specific entry in `src/data/errors.js`:

- confirm the source product and version when available
- prefer official docs and Laserfiche employee replies
- avoid duplicating an existing server-code entry unless the product-specific context adds a distinct fix path
- use the approved product list from `src/data/errors.js`
- record every promoted source in `src/data/reviewedSources.js`

# Changelog

## 2026-07-10

- Corrected numeric search relevance so error-code searches do not fuzzy-match unrelated digits.
- Preserved official documentation baselines by deduplicating on product and code instead of code alone.
- Removed duplicate catalog and ledger identities, normalized source classifications, and expanded data validation.
- Added generated product-level catalog chunks, lazy detail loading, and parity regression tests.
- Corrected Reset and filtered-selection behavior and improved dialog, tooltip, group, and ledger accessibility.
- Made Support KB and Answers research tooling date-independent and refreshed generated research reports.
- Reordered clean-build verification, added browser checks to Pages CI, and made local/CI browser launching portable.
- Updated Vite, the React plugin, and Lucide; corrected the Pages favicon path and remaining documentation drift.

## 2026-06-29

- Changed community contributions to an issue-only model and added a pull request template that redirects unrequested PRs to the issue templates.
- Added community readiness governance files, issue templates, contribution guidance, security policy, known limitations, maintenance plan, product aliases, data quality roadmap, and launch announcement draft.
- Added a public correction workflow in the app so users can open a prefilled GitHub issue for the selected error.
- Added launch-readiness smoke checks and data quality checks for source URLs, products, source types, aliases, and issue-template presence.
- Added public disclaimer and safety language for production changes.
- Added catalog lazy loading after the app shell mounts and disabled modulepreload for catalog chunks.
- Normalized the Forms `LFF502-UnexpectedError` aggregate entry so its scenario branches count in repeated-code reporting.
- Cleared the validation queue and documented the remaining roadmap: thin products, repeated-code scenarios, and official-doc baseline entries.

## 2026-06-28

- Reviewed priority source-backlog candidates, promoted WebLink/Workflow source-backed workarounds, added candidate-review indicators, and added `npm run review:candidate`.
- Added backlog curation for official-source matches, validation-status filtering, and deeper product discovery passes for backlog-heavy products.
- Re-searched the source-research backlog, added validation-status UI labels, compacted validation triage data, and ran low-coverage product discovery passes.
- Added validation batch completion triage and a separate source-research backlog.
- Added scenario variants for the remaining scenario-review entries and made priority-source curation merge-safe.
- Added community-confirmed fix curation for the next validation batches.
- Reviewed 138 priority-source validation candidates and added 86 conservative fix-status overrides.
- Added `npm run curation:priority` plus an auditable priority-source curation report.
- Added a full validation batch ledger for all 1,634 validation candidates in 50-entry batches.
- Added `npm run validation:batches` to regenerate the batch JSON and markdown reports.
- Added FicheBait branding, logo, color palette, and ICO favicon.
- Changed the first-visit detail pane to show instructions until a user selects an error.
- Added a research-focus panel for validation, source-backed fixes, and scenario entries.
- Added exact-code boosting and fuzzy token matching to search relevance.
- Added shareable URLs for search and filter state.
- Added local-only usage counters in the About dialog.
- Added `npm run quality` to generate `research/quality-report.md`.
- Added catalog and vendor chunk splitting in Vite for better cache boundaries.
- Added release process documentation.

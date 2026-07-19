# Known Limitations

The helper is ready for community browsing, but it should be read as a research index rather than official support guidance.

## Current Catalog Snapshot

Current counts are generated in `research/progress-report.md` and `research/quality-report.md`. Those reports are
regenerated from the published catalog during release verification.

## Thin Coverage Products

- AI Service and Webtools Agent remain the thinnest product areas in the generated product-coverage report.

These products need more source discovery before the catalog should be treated as broad coverage.

## Confidence Labels

- High confidence means the source evidence strongly supports the product, symptom, and fix.
- Medium confidence means the guidance is useful but may be scenario-specific or version-specific.
- Needs validation means the entry is useful for discovery but should not be treated as a confirmed fix.

## Fix Status Labels

- Known fix: source-backed fix for at least one matching scenario.
- Workaround: source-backed remediation that may not be permanent.
- Diagnostic only: useful investigation steps but no confirmed public fix.
- Needs review: official or captured error baseline that still needs source-backed fix research.

## Operational Safety

Do not apply database changes, service-account changes, certificate changes, IIS hardening exceptions, or production configuration changes without normal backup and change-control procedures.

This project is not affiliated with or endorsed by Laserfiche.

Laserfiche is a registered trademark of Compulink Management Center, Inc.

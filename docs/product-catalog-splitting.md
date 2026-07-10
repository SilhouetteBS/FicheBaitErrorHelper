# Product Catalog Splitting

The published catalog is still small enough to load as a static GitHub Pages app, but the current data shape is approaching the point where product-level chunks will be easier to maintain and faster to render.

## Implemented State

- `src/data/errors.js` remains the maintainer-facing merged publishable catalog.
- `tools/generate-published-catalog.mjs` generates a lightweight search index, a product-loader manifest, a runtime source ledger, and one full-detail module per product.
- `src/catalogLoader.js` loads the index and manifest first, then imports a product module only when one of its errors is selected.
- Direct `?error=<id>` links resolve the product from the lightweight index before loading the matching detail module.
- `tests/catalog.test.mjs` verifies entry IDs, source URLs, official product/code coverage, generated-index parity, and product-module parity.
- Vite modulepreload remains disabled so product chunks are not requested from the initial HTML.

## Generated Shape

The next target is true product slices under `src/data/products/`:

- `src/data/generated/catalogIndex.js` contains result metadata and compact searchable terms.
- `src/data/generated/catalogManifest.js` contains statically analyzable dynamic import functions for each product.
- `src/data/generated/products/<productKey>.js` exports full troubleshooting details for one product.
- `src/data/generated/reviewedSources.js` contains the deduplicated runtime ledger.

## Loading Behavior

- Initial page load imports product metadata, the compact search index, the product manifest, candidate-review metadata, and the source ledger.
- Global search and filters operate on lightweight rows without importing full troubleshooting prose.
- Selecting an error imports its product slice and hydrates the detail pane.
- Opening a direct `?error=<id>` link finds the product in the index, imports that slice, and selects the full entry.

## Maintenance Steps

1. Run `npm run generate:catalog` after changing publishable catalog or source-ledger data.
2. Run `npm test` to confirm generated/runtime parity.
3. Run `npm run build` and review emitted chunk sizes when product coverage grows materially.
4. Do not edit files under `src/data/generated/` directly.
5. Generated modules are ignored by Git and are recreated by `predev`, `pretest`, and `prebuild`.

## Guardrails

- Keep all published data sanitized; research-only notes and raw scraping artifacts stay under `research/`.
- Preserve GitHub Pages compatibility. The split data must be static ESM or JSON assets under the site base path.
- Do not change product names during the split. Product renames should remain separate data-cleanup changes.
- Keep the no-selection instruction pane behavior intact for first visits.

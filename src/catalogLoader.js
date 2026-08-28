export async function loadCatalogData() {
  const [indexModule, manifestModule, statsModule] = await Promise.all([
    import("./data/generated/catalogIndex.js"),
    import("./data/generated/catalogManifest.js"),
    import("./data/generated/catalogStats.js"),
  ]);

  const productCache = new Map();
  let reviewedSourcesPromise;
  let candidateReviewsPromise;

  async function loadProduct(product) {
    if (!product) return [];
    if (!productCache.has(product)) {
      const loader = manifestModule.productLoaders[product];
      if (!loader) return [];
      productCache.set(product, loader().then((module) => module.productEntries));
    }
    return productCache.get(product);
  }

  return {
    errorEntries: indexModule.catalogIndex,
    stats: statsModule.catalogStats,
    loadReviewedSources() {
      reviewedSourcesPromise ??= import("./data/generated/reviewedSources.js").then((module) => module.reviewedSources);
      return reviewedSourcesPromise;
    },
    loadCandidateReviews() {
      candidateReviewsPromise ??= import("./data/sourceCandidateReviews.js").then((module) => module.sourceCandidateReviews);
      return candidateReviewsPromise;
    },
    async loadEntry(entryId) {
      const indexEntry = indexModule.catalogIndex.find(
        (entry) => entry.id === entryId || entry.aliases?.includes(entryId),
      );
      const entries = await loadProduct(indexEntry?.product);
      return entries.find((entry) => entry.id === indexEntry?.id) ?? null;
    },
  };
}

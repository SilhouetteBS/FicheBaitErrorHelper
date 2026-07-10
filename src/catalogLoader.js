export async function loadCatalogData() {
  const [indexModule, sourcesModule, manifestModule, candidateReviewsModule] = await Promise.all([
    import("./data/generated/catalogIndex.js"),
    import("./data/generated/reviewedSources.js"),
    import("./data/generated/catalogManifest.js"),
    import("./data/sourceCandidateReviews.js"),
  ]);

  const productCache = new Map();

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
    reviewedSources: sourcesModule.reviewedSources,
    sourceCandidateReviews: candidateReviewsModule.sourceCandidateReviews,
    async loadEntry(entryId) {
      const product = indexModule.catalogIndex.find((entry) => entry.id === entryId)?.product;
      const entries = await loadProduct(product);
      return entries.find((entry) => entry.id === entryId) ?? null;
    },
  };
}

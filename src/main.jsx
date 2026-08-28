import React, { lazy, Suspense, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  HelpCircle,
  Info,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  productOptions,
  sourcePriority,
  sourceTypeOptions,
  versionOptions,
} from "./data/catalogMetadata.js";
import { loadCatalogData } from "./catalogLoader.js";
import { InfoDialog } from "./components/InfoDialog.jsx";
import { TooltipIcon } from "./components/TooltipIcon.jsx";
import { normalize, normalizeCode, searchScore } from "./search.js";
import {
  fixStatusMetadata,
  reviewStatusMetadata,
  statusLabel,
  validationStatusMetadata,
} from "./statusMetadata.js";
import "./styles.css";

const allOption = "All";
const ErrorDetail = lazy(() => import("./components/ErrorDetail.jsx").then((module) => ({ default: module.ErrorDetail })));
const usageStorageKey = "fichebait-error-helper-usage";
const defaultUsageStats = {
  searches: 0,
  selections: 0,
  shares: 0,
  filters: 0,
  lastEventAt: null,
};

function uniqueSorted(values) {
  return [allOption, ...Array.from(new Set(values.filter(Boolean))).sort()];
}

function withAll(values) {
  return [allOption, ...values];
}

function displayDate(value) {
  if (!value) return "No reviewed sources";
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function sourceRank(entry) {
  return Math.min(...(entry.sources ?? []).map((source) => sourcePriority[source.sourceType] ?? 99), 99);
}

function confidenceLabel(value) {
  if (value === "high") return "High confidence";
  if (value === "medium") return "Medium confidence";
  return "Needs validation";
}

function sourceTypeLabel(sourceType) {
  return sourceTypeOptions.find((option) => option.value === sourceType)?.label ?? sourceType;
}

function fixStatusLabel(value) {
  if (value === allOption) return allOption;
  return statusLabel(fixStatusMetadata, value, fixStatusMetadata["needs-review"].label);
}

function validationStatusLabel(value) {
  return statusLabel(validationStatusMetadata, value, "Not triaged");
}

function scenarioFilterLabel(value) {
  if (value === allOption) return allOption;
  const labels = {
    "has-scenarios": "Has multiple scenarios",
    "single-scenario": "No scenario variants",
  };
  return labels[value] ?? value;
}

function researchFilterLabel(value) {
  if (value === allOption) return allOption;
  const labels = {
    "needs-fix-research": "Needs fix research",
    "has-fix-guidance": "Has fix/workaround",
  };
  return labels[value] ?? value;
}

function validationFilterLabel(value) {
  if (value === allOption) return "All Validation";
  return validationStatusLabel(value);
}

function fixStatusValue(entry) {
  if (entry.fixStatus) return entry.fixStatus;
  if (entry.confidence === "low") return "needs-review";
  return "diagnostic-only";
}

function scenarioCount(entry) {
  return entry.scenarioCount ?? entry.scenarios?.length ?? 0;
}

function sourceIcon(sourceType) {
  if (sourceType === "official-docs") return BookOpen;
  if (sourceType === "support-knowledge-base") return BookOpen;
  if (sourceType === "answers-search") return Search;
  return MessageSquare;
}

function filterOptionLabel(value, label) {
  if (value !== allOption) return value;
  if (label === "Product") return "All Products";
  if (label === "Version") return "All Versions";
  if (label === "Source Confidence") return "All Confidence";
  if (label === "Fix Status") return "All Fix Statuses";
  if (label === "Fix Status / Research") return "All Fix Statuses / Research";
  if (label === "Source") return "All Sources";
  if (label === "Source Review Status") return "All Review Statuses";
  return value;
}

function initialSelectedErrorId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("error");
}

function initialParam(name, fallback = allOption) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || fallback;
}

function entryMatchesId(entry, entryId) {
  return entry?.id === entryId || entry?.aliases?.includes(entryId);
}

function canonicalEntryId(entries, entryId) {
  if (!entryId) return null;
  return entries.find((entry) => entryMatchesId(entry, entryId))?.id ?? null;
}

function setErrorUrl(entryId) {
  const url = new URL(window.location.href);
  if (entryId) url.searchParams.set("error", entryId);
  else url.searchParams.delete("error");
  url.hash = "";
  window.history.pushState({}, "", url);
}

function errorShareUrl(entryId) {
  const url = new URL(window.location.href);
  url.searchParams.set("error", entryId);
  url.hash = "";
  return url.toString();
}

function setQueryParam(url, name, value, fallback = allOption) {
  if (!value || value === fallback) {
    url.searchParams.delete(name);
    return;
  }
  url.searchParams.set(name, value);
}

function readUsageStats() {
  try {
    const stored = window.localStorage.getItem(usageStorageKey);
    return stored ? { ...defaultUsageStats, ...JSON.parse(stored) } : defaultUsageStats;
  } catch {
    return defaultUsageStats;
  }
}

function recordUsageEvent(type) {
  try {
    const current = readUsageStats();
    const next = {
      ...current,
      [type]: (current[type] ?? 0) + 1,
      lastEventAt: new Date().toISOString(),
    };
    window.localStorage.setItem(usageStorageKey, JSON.stringify(next));
    return next;
  } catch {
    return defaultUsageStats;
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.append(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

function reviewStatusLabel(value) {
  return statusLabel(reviewStatusMetadata, value);
}

function sourceReviewStatusFor(sourceItem, reviewedSources) {
  if (!sourceItem?.url) return "curated";
  if (reviewedSources instanceof Map) return reviewedSources.get(sourceItem.url) ?? "curated";
  return reviewedSources.find((reviewedSource) => reviewedSource?.url === sourceItem.url)?.reviewStatus ?? "curated";
}

function entryHasReviewStatus(entry, reviewStatus, reviewedSources) {
  if (entry.reviewStatuses) return entry.reviewStatuses.includes(reviewStatus);
  return entry.sources.some((sourceItem) => sourceReviewStatusFor(sourceItem, reviewedSources) === reviewStatus);
}

function activeFilterItems({
  query,
  product,
  version,
  source,
  confidence,
  fixStatus,
  scenarioFilter,
  researchFilter,
  validationFilter,
  reviewStatusFilter,
}) {
  const fixResearchValue =
    fixStatus !== allOption
      ? { key: "fixResearch", label: "Fix Status / Research", value: fixStatusLabel(fixStatus) }
      : researchFilter !== allOption && { key: "fixResearch", label: "Fix Status / Research", value: researchFilterLabel(researchFilter) };

  return [
    query.trim() && { key: "query", label: "Search", value: query.trim() },
    product !== allOption && { key: "product", label: "Product", value: product },
    version !== allOption && { key: "version", label: "Version", value: version },
    source !== allOption && { key: "source", label: "Source", value: sourceTypeLabel(source) },
    confidence !== allOption && { key: "confidence", label: "Confidence", value: confidence },
    fixResearchValue,
    scenarioFilter !== allOption && { key: "scenarioFilter", label: "Scenario Coverage", value: scenarioFilterLabel(scenarioFilter) },
    validationFilter !== allOption && { key: "validationFilter", label: "Validation", value: validationFilterLabel(validationFilter) },
    reviewStatusFilter !== allOption && { key: "reviewStatusFilter", label: "Review Status", value: reviewStatusLabel(reviewStatusFilter) },
  ].filter(Boolean);
}

function App() {
  const [query, setQuery] = useState(() => initialParam("q", "").slice(0, 200));
  const [product, setProduct] = useState(() => initialParam("product"));
  const [version, setVersion] = useState(() => initialParam("version"));
  const [source, setSource] = useState(() => initialParam("source"));
  const [confidence, setConfidence] = useState(() => initialParam("confidence"));
  const [fixStatus, setFixStatus] = useState(() => initialParam("fix"));
  const [scenarioFilter, setScenarioFilter] = useState(() => initialParam("scenarios"));
  const [researchFilter, setResearchFilter] = useState(() => initialParam("research"));
  const [validationFilter, setValidationFilter] = useState(() => initialParam("validation"));
  const [sortBy, setSortBy] = useState(() => initialParam("sort", "relevance"));
  const [ledgerSource, setLedgerSource] = useState(() => initialParam("ledger"));
  const [reviewStatusFilter, setReviewStatusFilter] = useState(() => initialParam("review"));
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedId, setSelectedId] = useState(initialSelectedErrorId);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [notification, setNotification] = useState("");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState(null);
  const [usageStats, setUsageStats] = useState(readUsageStats);
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState("");
  const [reviewedSources, setReviewedSources] = useState(null);
  const [sourceCandidateReviews, setSourceCandidateReviews] = useState({});
  const ledgerRef = useRef(null);

  const errorEntries = catalog?.errorEntries ?? [];
  const loadedReviewedSources = reviewedSources ?? [];
  const reviewStatusByUrl = useMemo(
    () => new Map(loadedReviewedSources.filter((item) => item.url).map((item) => [item.url, item.reviewStatus])),
    [loadedReviewedSources],
  );
  const candidateReviewsByEntry = useMemo(() => {
    const grouped = new Map();
    for (const review of Object.values(sourceCandidateReviews)) {
      if (!grouped.has(review.entryId)) grouped.set(review.entryId, []);
      grouped.get(review.entryId).push(review);
    }
    return grouped;
  }, [sourceCandidateReviews]);
  const isCatalogLoading = !catalog && !catalogError;
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let isCurrent = true;

    loadCatalogData()
      .then((loadedCatalog) => {
        if (isCurrent) setCatalog(loadedCatalog);
      })
      .catch(() => {
        if (isCurrent) setCatalogError("The error catalog could not be loaded. Refresh the page and try again.");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!catalog || reviewedSources || !ledgerRef.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        catalog.loadReviewedSources().then(setReviewedSources).catch(() => setCatalogError("The source ledger could not be loaded."));
        observer.disconnect();
      },
      { rootMargin: "300px" },
    );
    observer.observe(ledgerRef.current);
    return () => observer.disconnect();
  }, [catalog, reviewedSources]);

  useEffect(() => {
    if (!catalog || !selectedId) return;
    const canonicalId = canonicalEntryId(errorEntries, selectedId);
    if (!canonicalId) setSelectedId(null);
    else if (canonicalId !== selectedId) setSelectedId(canonicalId);
  }, [catalog, errorEntries, selectedId]);

  useEffect(() => {
    let isCurrent = true;
    setSelectedDetail(null);
    if (!catalog || !selectedId) return () => {
      isCurrent = false;
    };

    catalog
      .loadEntry(selectedId)
      .then((entry) => {
        if (isCurrent) setSelectedDetail(entry);
      })
      .catch(() => {
        if (isCurrent) setCatalogError("The selected error details could not be loaded. Refresh the page and try again.");
      });

    return () => {
      isCurrent = false;
    };
  }, [catalog, selectedId]);

  useEffect(() => {
    if (!catalog || !selectedId) return;
    catalog.loadCandidateReviews().then(setSourceCandidateReviews).catch(() => {});
    if (!reviewedSources) catalog.loadReviewedSources().then(setReviewedSources).catch(() => {});
  }, [catalog, reviewedSources, selectedId]);

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = window.setTimeout(() => setNotification(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    const url = new URL(window.location.href);
    setQueryParam(url, "q", query, "");
    setQueryParam(url, "product", product);
    setQueryParam(url, "version", version);
    setQueryParam(url, "source", source);
    setQueryParam(url, "confidence", confidence);
    setQueryParam(url, "fix", fixStatus);
    setQueryParam(url, "scenarios", scenarioFilter);
    setQueryParam(url, "research", researchFilter);
    setQueryParam(url, "validation", validationFilter);
    setQueryParam(url, "sort", sortBy, "relevance");
    setQueryParam(url, "ledger", ledgerSource);
    setQueryParam(url, "review", reviewStatusFilter);
    if (selectedId) url.searchParams.set("error", selectedId);
    else url.searchParams.delete("error");
    url.hash = "";
    window.history.replaceState({}, "", url);
  }, [query, product, version, source, confidence, fixStatus, scenarioFilter, researchFilter, validationFilter, sortBy, ledgerSource, reviewStatusFilter, selectedId]);

  useEffect(() => {
    function restoreFromUrl() {
      const url = new URL(window.location.href);
      setQuery((url.searchParams.get("q") ?? "").slice(0, 200));
      setProduct(url.searchParams.get("product") ?? allOption);
      setVersion(url.searchParams.get("version") ?? allOption);
      setSource(url.searchParams.get("source") ?? allOption);
      setConfidence(url.searchParams.get("confidence") ?? allOption);
      setFixStatus(url.searchParams.get("fix") ?? allOption);
      setScenarioFilter(url.searchParams.get("scenarios") ?? allOption);
      setResearchFilter(url.searchParams.get("research") ?? allOption);
      setValidationFilter(url.searchParams.get("validation") ?? allOption);
      setSortBy(url.searchParams.get("sort") ?? "relevance");
      setLedgerSource(url.searchParams.get("ledger") ?? allOption);
      setReviewStatusFilter(url.searchParams.get("review") ?? allOption);
      setSelectedId(url.searchParams.get("error"));
    }
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;
    const timeout = window.setTimeout(() => {
      setUsageStats(recordUsageEvent("searches"));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filters = useMemo(
    () => ({
      products: withAll(productOptions),
      versions: withAll(versionOptions),
      sources: [
        allOption,
        ...sourceTypeOptions
          .filter((option) =>
            errorEntries.some((entry) => entry.sources.some((item) => item.sourceType === option.value)) ||
            (catalog?.stats.sourceTypes ?? []).includes(option.value),
          )
          .map((option) => option.value),
      ],
      confidences: uniqueSorted(errorEntries.map((entry) => confidenceLabel(entry.confidence))),
      fixStatuses: withAll(["known-fix", "workaround", "diagnostic-only", "unresolved", "needs-review"]),
      scenarioStates: withAll(["has-scenarios", "single-scenario"]),
      researchStates: withAll(["needs-fix-research", "has-fix-guidance"]),
      fixResearchStates: withAll(["known-fix", "workaround", "diagnostic-only", "unresolved", "needs-review", "has-fix-guidance", "needs-fix-research"]),
      validationStates: withAll(["source-research-needed", "reviewed-diagnostic", "official-doc-baseline"]),
      reviewStatuses: withAll(["curated", "curated-partial", "curated-unresolved", "cross-product", "not-actionable", "no-matching-posts"]),
    }),
    [catalog, errorEntries],
  );

  const filteredEntries = useMemo(() => {
    const term = normalize(deferredQuery);
    return errorEntries
      .map((entry) => ({ entry, score: searchScore(entry, term) }))
      .filter(({ score }) => !term || score > 0)
      .map(({ entry, score }) => ({ ...entry, searchScore: score }))
      .filter((entry) => product === allOption || entry.product === product)
      .filter((entry) => version === allOption || entry.versions.includes(version))
      .filter((entry) => source === allOption || entry.sources.some((item) => item.sourceType === source))
      .filter((entry) => confidence === allOption || confidenceLabel(entry.confidence) === confidence)
      .filter((entry) => fixStatus === allOption || fixStatusValue(entry) === fixStatus)
      .filter((entry) => {
        if (scenarioFilter === "has-scenarios") return scenarioCount(entry) > 0;
        if (scenarioFilter === "single-scenario") return scenarioCount(entry) === 0;
        return true;
      })
      .filter((entry) => {
        const status = fixStatusValue(entry);
        if (researchFilter === "needs-fix-research") {
          return status === "diagnostic-only" || status === "unresolved" || status === "needs-review";
        }
        if (researchFilter === "has-fix-guidance") return status === "known-fix" || status === "workaround";
        return true;
      })
      .filter((entry) => validationFilter === allOption || entry.validationStatus === validationFilter)
      .filter((entry) => reviewStatusFilter === allOption || entryHasReviewStatus(entry, reviewStatusFilter, loadedReviewedSources))
      .sort((a, b) => {
        if (sortBy === "code") return a.code.localeCompare(b.code, undefined, { numeric: true });
        if (sortBy === "confidence") return confidenceWeight(a.confidence) - confidenceWeight(b.confidence);
        if (sortBy === "product") return a.product.localeCompare(b.product) || a.code.localeCompare(b.code);
        return b.searchScore - a.searchScore || sourceRank(a) - sourceRank(b) || a.code.localeCompare(b.code, undefined, { numeric: true });
      });
  }, [deferredQuery, errorEntries, loadedReviewedSources, product, version, source, confidence, fixStatus, scenarioFilter, researchFilter, validationFilter, reviewStatusFilter, sortBy]);

  const selectedSummary = selectedId ? errorEntries.find((entry) => entryMatchesId(entry, selectedId)) : null;
  const latestSourceDate = catalog?.stats.latestSourceDate;

  useEffect(() => {
    if (!catalog || !selectedId) return;
    if (!filteredEntries.some((entry) => entryMatchesId(entry, selectedId))) setSelectedId(null);
  }, [catalog, filteredEntries, selectedId]);

  const qualitySummary = useMemo(() => {
    const needsSourceResearch = errorEntries.filter((entry) => entry.validationStatus === "source-research-needed");
    const hasGuidance = errorEntries.filter((entry) => ["known-fix", "workaround"].includes(fixStatusValue(entry)));
    const scenarioEntries = errorEntries.filter((entry) => scenarioCount(entry) > 0);
    const unresolvedEntries = errorEntries.filter((entry) => ["unresolved", "needs-review"].includes(fixStatusValue(entry)));
    const officialBaseline = errorEntries.filter((entry) => entry.validationStatus === "official-doc-baseline");
    const reviewedDiagnostic = errorEntries.filter((entry) => entry.validationStatus === "reviewed-diagnostic");
    return {
      needsSourceResearch: needsSourceResearch.length,
      lowConfidence: errorEntries.filter((entry) => entry.confidence === "low").length,
      hasGuidance: hasGuidance.length,
      scenarioEntries: scenarioEntries.length,
      unresolvedEntries: unresolvedEntries.length,
      officialBaseline: officialBaseline.length,
      reviewedDiagnostic: reviewedDiagnostic.length,
    };
  }, [errorEntries]);

  function trackFilterChange(setter) {
    return (value) => {
      setter(value);
      setUsageStats(recordUsageEvent("filters"));
    };
  }

  function clearActiveFilter(key) {
    const clearers = {
      query: () => setQuery(""),
      product: () => setProduct(allOption),
      version: () => setVersion(allOption),
      source: () => setSource(allOption),
      confidence: () => setConfidence(allOption),
      fixStatus: () => setFixStatus(allOption),
      fixResearch: () => {
        setFixStatus(allOption);
        setResearchFilter(allOption);
      },
      scenarioFilter: () => setScenarioFilter(allOption),
      researchFilter: () => setResearchFilter(allOption),
      validationFilter: () => setValidationFilter(allOption),
      reviewStatusFilter: () => setReviewStatusFilter(allOption),
    };

    clearers[key]?.();
    setUsageStats(recordUsageEvent("filters"));
  }

  function selectEntry(entryId) {
    setSelectedId(entryId);
    setErrorUrl(entryId);
    setUsageStats(recordUsageEvent("selections"));
    if (window.matchMedia("(max-width: 720px)").matches) {
      window.requestAnimationFrame(() => document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  function clearSelection() {
    setSelectedId(null);
    setSelectedDetail(null);
    setErrorUrl(null);
  }

  async function shareEntry(entry) {
    const shareUrl = errorShareUrl(entry.id);
    await copyToClipboard(shareUrl);
    setNotification(`Copied link for ${entry.code}.`);
    setUsageStats(recordUsageEvent("shares"));
  }

  function handleFixResearchFilter(value) {
    if (value === allOption) {
      setFixStatus(allOption);
      setResearchFilter(allOption);
    } else if (filters.researchStates.includes(value)) {
      setFixStatus(allOption);
      setResearchFilter(value);
    } else {
      setFixStatus(value);
      setResearchFilter(allOption);
    }

    setUsageStats(recordUsageEvent("filters"));
  }

  const groupedEntries = useMemo(() => {
    return filteredEntries.reduce((groups, entry) => {
      groups[entry.product] ||= [];
      groups[entry.product].push(entry);
      return groups;
    }, {});
  }, [filteredEntries]);

  const sortedGroupedEntries = useMemo(
    () => Object.entries(groupedEntries).sort(([productA], [productB]) => productA.localeCompare(productB)),
    [groupedEntries],
  );

  useEffect(() => {
    const normalizedQuery = normalize(query);
    const queryCode = normalizeCode(query);
    if (!normalizedQuery) return;
    const exactProducts = errorEntries
      .filter((entry) => normalize(entry.message) === normalizedQuery || (queryCode && normalizeCode(entry.code) === queryCode))
      .map((entry) => entry.product);
    if (exactProducts.length === 0) return;
    setCollapsedGroups((current) => Object.fromEntries([...Object.entries(current), ...exactProducts.map((name) => [name, false])]));
  }, [errorEntries, query]);

  const displayedReviewedSources = loadedReviewedSources.filter(
    (sourceItem) =>
      (ledgerSource === allOption || sourceItem.sourceType === ledgerSource) &&
      (reviewStatusFilter === allOption || sourceItem.reviewStatus === reviewStatusFilter),
  );
  const ledgerPageSize = 50;
  const ledgerPageCount = Math.max(1, Math.ceil(displayedReviewedSources.length / ledgerPageSize));
  const ledgerRows = isLedgerExpanded
    ? displayedReviewedSources.slice(ledgerPage * ledgerPageSize, (ledgerPage + 1) * ledgerPageSize)
    : displayedReviewedSources.slice(0, 5);

  useEffect(() => {
    setLedgerPage(0);
  }, [ledgerSource, reviewStatusFilter]);
  const activeFilters = activeFilterItems({
    query,
    product,
    version,
    source,
    confidence,
    fixStatus,
    scenarioFilter,
    researchFilter,
    validationFilter,
    reviewStatusFilter,
  });

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-row">
            <img
              className="brand-logo"
              src={`${import.meta.env.BASE_URL}fichebait-logo.png`}
              alt="FicheBait"
              width="168"
              height="36"
            />
            <h1>Error Helper</h1>
          </div>
          <nav className="top-actions" aria-label="Utility links">
            <span>Sources reviewed through {displayDate(latestSourceDate)}</span>
            <RefreshCw aria-hidden="true" size={16} />
            <button className="utility-link" onClick={() => setInfoDialog("how")} type="button">
              <HelpCircle aria-hidden="true" size={16} />
              How it works
            </button>
            <button className="utility-link" onClick={() => setInfoDialog("about")} type="button">
              <Info aria-hidden="true" size={16} />
              About
            </button>
          </nav>
        </div>
      </header>

      <main className="app-shell">
        <section className="notice helper-warning" aria-label="Important helper notice">
          <ShieldAlert aria-hidden="true" size={18} />
          <p>
            This community research aid for Laserfiche software is for read-only reporting, troubleshooting, and
            education. It is not affiliated with or endorsed by Laserfiche. Manually modifying Laserfiche databases
            is unsupported and violates your support plan; validate changes in a test environment.{" "}
            <a href="https://github.com/SilhouetteBS/FicheBaitErrorHelper/blob/main/docs/known-limitations.md" rel="noreferrer" target="_blank">
              Known limitations
              <ExternalLink aria-hidden="true" size={13} />
            </a>
          </p>
        </section>

        <section className="toolbar" aria-label="Search and filters">
          <label className="search-control">
            <Search aria-hidden="true" size={20} />
            <input
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, message, symptom, product, or fix"
              type="search"
            />
            {query && (
              <button aria-label="Clear search" className="clear-search" onClick={() => setQuery("")} type="button">
                <X aria-hidden="true" size={19} />
              </button>
            )}
          </label>
          <FilterSelect label="Product" value={product} onChange={trackFilterChange(setProduct)} options={filters.products} />
          <FilterSelect label="Version" value={version} onChange={trackFilterChange(setVersion)} options={filters.versions} />
          <FilterSelect
            label="Source"
            className="source-filter"
            value={source}
            onChange={trackFilterChange(setSource)}
            options={filters.sources}
            formatOption={sourceTypeLabel}
          />
          <button
            aria-controls="advanced-filters"
            aria-expanded={isMoreFiltersOpen}
            className={`more-filters ${isMoreFiltersOpen ? "active" : ""}`}
            onClick={() => setIsMoreFiltersOpen((current) => !current)}
            type="button"
          >
            <Filter aria-hidden="true" size={17} />
            More Filters
          </button>
          <button
            className="reset-button"
            onClick={() => {
              setQuery("");
              setProduct(allOption);
              setVersion(allOption);
              setSource(allOption);
              setConfidence(allOption);
              setFixStatus(allOption);
              setScenarioFilter(allOption);
              setResearchFilter(allOption);
              setValidationFilter(allOption);
              setSortBy("relevance");
              setLedgerSource(allOption);
              setReviewStatusFilter(allOption);
              setIsLedgerExpanded(false);
              setIsMoreFiltersOpen(false);
              setSelectedId(null);
            }}
            type="button"
          >
            Reset
          </button>
        </section>

        {isMoreFiltersOpen && (
          <section className="advanced-filters" id="advanced-filters" aria-label="More filters">
            <div className="advanced-filter-summary">
              <h2>More Filters</h2>
              <p>Use these filters to narrow results by source confidence, fix maturity, scenario coverage, and review status.</p>
            </div>
            <FilterSelect
              label="Source Confidence"
              value={confidence}
              onChange={trackFilterChange(setConfidence)}
              options={filters.confidences}
            />
            <FilterSelect
              label="Fix Status / Research"
              value={fixStatus !== allOption ? fixStatus : researchFilter}
              onChange={handleFixResearchFilter}
              options={filters.fixResearchStates}
              formatOption={(value) => (filters.researchStates.includes(value) ? researchFilterLabel(value) : fixStatusLabel(value))}
            />
            <FilterSelect
              label="Scenario Coverage"
              value={scenarioFilter}
              onChange={trackFilterChange(setScenarioFilter)}
              options={filters.scenarioStates}
              formatOption={scenarioFilterLabel}
            />
            <FilterSelect
              label="Validation"
              value={validationFilter}
              onChange={trackFilterChange(setValidationFilter)}
              options={filters.validationStates}
              formatOption={validationFilterLabel}
            />
            <FilterSelect
              label="Source Review Status"
              value={reviewStatusFilter}
              onChange={trackFilterChange(setReviewStatusFilter)}
              options={filters.reviewStatuses}
              formatOption={reviewStatusLabel}
            />
            <label className="filter-control">
              <span>Result Sort</span>
              <select value={sortBy} onChange={(event) => trackFilterChange(setSortBy)(event.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="code">Error code</option>
                <option value="confidence">Confidence</option>
                <option value="product">Product</option>
              </select>
            </label>
          </section>
        )}

        {activeFilters.length > 0 && (
          <section className="active-filters" aria-label="Active filters">
            <span>Active filters</span>
            <div>
              {activeFilters.map((item) => (
                <button
                  aria-label={`Clear ${item.label} filter`}
                  className="filter-chip"
                  key={`${item.key}-${item.value}`}
                  onClick={() => clearActiveFilter(item.key)}
                  type="button"
                >
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                  <X aria-hidden="true" size={13} />
                </button>
              ))}
            </div>
          </section>
        )}

      <section className={`workspace ${selectedId ? "has-selection" : ""}`}>
        <aside className="results-pane" aria-label="Error results">
          <div className="pane-heading">
            <div>
              <h2>{isCatalogLoading ? "Loading results" : `${filteredEntries.length} results`}</h2>
            </div>
            <div className="sort-control">
              <label>
                <span>Sort by:</span>
                <select value={sortBy} onChange={(event) => trackFilterChange(setSortBy)(event.target.value)}>
                  <option value="relevance">Relevance</option>
                  <option value="code">Error code</option>
                  <option value="confidence">Confidence</option>
                  <option value="product">Product</option>
                </select>
              </label>
              <button
                aria-controls="advanced-filters"
                aria-expanded={isMoreFiltersOpen}
                aria-label="Open result filters"
                className={`sort-filter-button ${isMoreFiltersOpen ? "active" : ""}`}
                onClick={() => setIsMoreFiltersOpen(true)}
                title="Open more filters"
                type="button"
              >
                <Filter aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
          {isCatalogLoading ? (
            <div className="empty-state">
              <RefreshCw aria-hidden="true" size={22} />
              <p>Loading the error catalog.</p>
            </div>
          ) : catalogError ? (
            <div className="empty-state">
              <AlertTriangle aria-hidden="true" size={22} />
              <p>{catalogError}</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle aria-hidden="true" size={22} />
              <p>No curated entries match the current filters.</p>
            </div>
          ) : (
            sortedGroupedEntries.map(([groupProduct, entries]) => {
              const isCollapsed = collapsedGroups[groupProduct] ?? true;

              return (
                <div className="result-group" key={groupProduct}>
                  <button
                    aria-controls={`results-${normalizeCode(groupProduct)}`}
                    aria-expanded={!isCollapsed}
                    className="group-toggle"
                    onClick={() =>
                      setCollapsedGroups((current) => ({
                        ...current,
                        [groupProduct]: !isCollapsed,
                      }))
                    }
                    type="button"
                  >
                    {isCollapsed ? (
                      <ChevronRight aria-hidden="true" size={17} />
                    ) : (
                      <ChevronDown aria-hidden="true" size={17} />
                    )}
                    <span>{groupProduct}</span>
                    <small>{entries.length}</small>
                  </button>
                  {!isCollapsed && (
                    <div id={`results-${normalizeCode(groupProduct)}`}>
                    {entries.map((entry) => (
                      <button
                        className={`result-row ${selectedSummary?.id === entry.id ? "selected" : ""}`}
                        key={entry.id}
                        onClick={() => selectEntry(entry.id)}
                        type="button"
                      >
                        <span className="code">{entry.code}</span>
                        <span>
                          <strong>{entry.message}</strong>
                        </span>
                        <span className="result-badges">
                          {scenarioCount(entry) > 0 && <span className="scenario-count">{scenarioCount(entry)} scenarios</span>}
                          <FixStatusBadge value={fixStatusValue(entry)} />
                          <ConfidenceBadge value={entry.confidence} />
                        </span>
                      </button>
                    ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </aside>

        {selectedDetail ? (
          <Suspense fallback={<article className="detail-pane instructions-pane"><div className="empty-state"><RefreshCw aria-hidden="true" size={22} /><p>Loading troubleshooting details.</p></div></article>}>
            <ErrorDetail
              entry={selectedDetail}
              allEntries={errorEntries}
              reviewedSources={reviewStatusByUrl}
              sourceCandidateReviews={candidateReviewsByEntry}
              onSelect={selectEntry}
              onShare={shareEntry}
              onBack={clearSelection}
            />
          </Suspense>
        ) : selectedSummary ? (
          <article className="detail-pane instructions-pane" aria-live="polite">
            <div className="empty-state">
              <RefreshCw aria-hidden="true" size={22} />
              <p>Loading troubleshooting details.</p>
            </div>
          </article>
        ) : (
          <InstructionsPane />
        )}
      </section>

      <section className="ledger-panel" aria-label="Reviewed source ledger" ref={ledgerRef}>
        <div className="ledger-heading">
          <div>
            <h2>Reviewed Source Ledger</h2>
            <span>{catalog?.stats.reviewedSourceCount ?? 0} sources</span>
          </div>
          <div className="ledger-actions">
            <span>Showing:</span>
            <select
              aria-label="Ledger source"
              value={ledgerSource}
              onChange={(event) => trackFilterChange(setLedgerSource)(event.target.value)}
            >
              {filters.sources.map((option) => (
                <option key={option} value={option}>
                  {filterOptionLabel(sourceTypeLabel(option), "Source")}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setIsLedgerExpanded((current) => !current)}>
              {isLedgerExpanded ? "Show fewer" : "View full ledger"}
            </button>
          </div>
        </div>
        <div className="ledger-table" role="table" aria-label="Reviewed source ledger table">
          <div role="rowgroup">
            <div className="ledger-row ledger-head" role="row">
              <span role="columnheader">Source</span>
              <span role="columnheader">Type</span>
              <span role="columnheader">Priority</span>
              <span role="columnheader">Last Reviewed</span>
              <span role="columnheader">Review Status</span>
              <span role="columnheader">Notes</span>
            </div>
          </div>
          <div role="rowgroup">
            {!reviewedSources && (
              <div className="ledger-row ledger-loading" role="row">
                <span role="cell">Loading reviewed sources...</span>
              </div>
            )}
            {ledgerRows.map((sourceItem) => (
              <div className="ledger-row" key={sourceItem.id} role="row">
                <span className="ledger-source-name" role="cell">
                  <SourceTypeIcon sourceType={sourceItem.sourceType} />
                  <a href={sourceItem.url} rel="noreferrer" target="_blank">
                    <strong>{sourceItem.title}</strong>
                  </a>
                </span>
                <span role="cell">{sourceTypeLabel(sourceItem.sourceType)}</span>
                <span role="cell">{sourcePriority[sourceItem.sourceType] ?? "Review"}</span>
                <span role="cell">{sourceItem.reviewedDate}</span>
                <span role="cell">
                  <ReviewStatusBadge value={sourceItem.reviewStatus} />
                </span>
                <span role="cell">{sourceItem.extractedErrorCodes.join(", ") || sourceItem.reviewStatus}</span>
              </div>
            ))}
          </div>
        </div>
        {isLedgerExpanded && displayedReviewedSources.length > ledgerPageSize && (
          <nav className="ledger-pagination" aria-label="Reviewed source pages">
            <button disabled={ledgerPage === 0} onClick={() => setLedgerPage((page) => Math.max(0, page - 1))} type="button">
              Previous
            </button>
            <span>Page {ledgerPage + 1} of {ledgerPageCount}</span>
            <button disabled={ledgerPage + 1 >= ledgerPageCount} onClick={() => setLedgerPage((page) => Math.min(ledgerPageCount - 1, page + 1))} type="button">
              Next
            </button>
          </nav>
        )}
      </section>
      </main>
      {infoDialog && (
        <InfoDialog
          type={infoDialog}
          usageStats={usageStats}
          qualitySummary={qualitySummary}
          onClose={() => setInfoDialog(null)}
        />
      )}
      <div className={`toast ${notification ? "visible" : ""}`} role="status" aria-live="polite">
        {notification}
      </div>
    </>
  );
}

function FilterSelect({ label, options, value, onChange, formatOption = (option) => option, className = "" }) {
  const selectId = useId();
  return (
    <div className={`filter-control ${className}`.trim()}>
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {filterOptionLabel(formatOption(option), label)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ConfidenceBadge({ value }) {
  return <span className={`confidence ${value}`}>{confidenceLabel(value)}</span>;
}

function FixStatusBadge({ value }) {
  return <span className={`fix-status ${value}`}>{fixStatusLabel(value)}</span>;
}

function ReviewStatusBadge({ value }) {
  return <span className={`review-status ${value}`}>{reviewStatusLabel(value)}</span>;
}

function confidenceWeight(value) {
  if (value === "high") return 1;
  if (value === "medium") return 2;
  return 3;
}

function SourceTypeIcon({ sourceType }) {
  const Icon = sourceIcon(sourceType);
  return <Icon aria-hidden="true" size={17} />;
}

function InstructionsPane() {
  return (
    <article className="detail-pane instructions-pane">
      <div className="instructions-content">
        <span className="selected-label">Get started</span>
        <h2>
          Search or browse Laserfiche errors
          <span>Select a result to view troubleshooting details.</span>
        </h2>
        <div className="instruction-grid">
          <section>
            <Search aria-hidden="true" size={19} />
            <div>
              <h3>Search by what you have</h3>
              <p>Use an error code, product name, message text, symptom, or source detail.</p>
            </div>
          </section>
          <section>
            <Filter aria-hidden="true" size={19} />
            <div>
              <h3>Narrow the results</h3>
              <p>Filter by product, version, source type, confidence, fix status, or scenario coverage.</p>
            </div>
          </section>
          <section>
            <BookOpen aria-hidden="true" size={19} />
            <div>
              <h3>Check the source trail</h3>
              <p>Review official documentation and Laserfiche Answers links before making system changes.</p>
            </div>
          </section>
        </div>
      </div>
    </article>
  );
}

const rootElement = document.getElementById("root");
const appRoot = window.__ficheBaitErrorHelperRoot ?? createRoot(rootElement);
window.__ficheBaitErrorHelperRoot = appRoot;
appRoot.render(<App />);

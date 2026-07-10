import React, { useEffect, useId, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  HelpCircle,
  Info,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Stethoscope,
  Wrench,
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
import "./styles.css";

const allOption = "All";
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
  return Math.min(...entry.sources.map((source) => sourcePriority[source.sourceType] ?? 99));
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
  const labels = {
    "known-fix": "Known fix",
    workaround: "Workaround",
    "diagnostic-only": "Diagnostic only",
    unresolved: "Unresolved",
    "needs-review": "Needs review",
  };
  return labels[value] ?? labels["needs-review"];
}

function validationStatusLabel(value) {
  const labels = {
    "official-doc-baseline": "Official doc baseline",
    "reviewed-diagnostic": "Reviewed diagnostic",
    "source-research-needed": "Needs source research",
  };
  return labels[value] ?? "Not triaged";
}

function validationStatusDescription(value) {
  const descriptions = {
    "official-doc-baseline": "This error is listed in official documentation, but no public Answers fix has been attached yet.",
    "reviewed-diagnostic": "Current sources were reviewed; keep this as diagnostic guidance unless stronger evidence is found.",
    "source-research-needed": "The entry is documented for discovery, but it still needs deeper source research before promoting a fix.",
  };
  return descriptions[value] ?? "This entry has not been included in a validation triage pass yet.";
}

function candidateReviewSummary(entryId, sourceCandidateReviews) {
  const reviews = Object.values(sourceCandidateReviews).filter((review) => review.entryId === entryId);
  if (reviews.length === 0) return null;
  const accepted = reviews.filter((review) => review.disposition.startsWith("accepted-")).length;
  if (accepted > 0) return { label: "Candidate source found", className: "candidate-found", count: accepted };
  return { label: "Candidate reviewed", className: "candidate-reviewed", count: reviews.length };
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

function setErrorUrl(entryId) {
  const url = new URL(window.location.href);
  url.searchParams.set("error", entryId);
  url.hash = "";
  window.history.replaceState({}, "", url);
}

function errorShareUrl(entryId) {
  const url = new URL(window.location.href);
  url.searchParams.set("error", entryId);
  url.hash = "";
  return url.toString();
}

function correctionIssueUrl(entry) {
  const params = new URLSearchParams({
    template: "error-report.yml",
    title: `[Error entry]: ${entry.code} - ${entry.product}`,
    code: `${entry.code} - ${entry.message}`,
    product: entry.product,
    version: entry.versions.join(", "),
    symptoms: [
      `Entry ID: ${entry.id}`,
      `Live URL: ${errorShareUrl(entry.id)}`,
      "",
      "Describe what is incorrect or missing:",
    ].join("\n"),
    source: entry.sources.map((sourceItem) => sourceItem.url).join("\n"),
  });

  return `https://github.com/SilhouetteBS/LaserficheErrorHelper/issues/new?${params.toString()}`;
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
  const labels = {
    curated: "Curated",
    "curated-partial": "Curated partial",
    "curated-unresolved": "Curated unresolved",
    candidate: "Candidate",
    "cross-product": "Cross-product",
    "not-actionable": "Not actionable",
    "no-matching-posts": "No matching posts",
  };
  return labels[value] ?? value;
}

function sourceReviewStatusFor(sourceItem, reviewedSources) {
  if (!sourceItem?.url) return "curated";
  return reviewedSources.find((reviewedSource) => reviewedSource?.url === sourceItem.url)?.reviewStatus ?? "curated";
}

function entryHasReviewStatus(entry, reviewStatus, reviewedSources) {
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
  const [query, setQuery] = useState(() => initialParam("q", ""));
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
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedId, setSelectedId] = useState(initialSelectedErrorId);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [notification, setNotification] = useState("");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState(null);
  const [usageStats, setUsageStats] = useState(readUsageStats);
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState("");

  const errorEntries = catalog?.errorEntries ?? [];
  const reviewedSources = catalog?.reviewedSources ?? [];
  const sourceCandidateReviews = catalog?.sourceCandidateReviews ?? {};
  const isCatalogLoading = !catalog && !catalogError;

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
    if (!catalog || !selectedId) return;
    if (!errorEntries.some((entry) => entry.id === selectedId)) setSelectedId(null);
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
            reviewedSources.some((item) => item.sourceType === option.value),
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
    [errorEntries, reviewedSources],
  );

  const filteredEntries = useMemo(() => {
    const term = normalize(query);
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
      .filter((entry) => reviewStatusFilter === allOption || entryHasReviewStatus(entry, reviewStatusFilter, reviewedSources))
      .sort((a, b) => {
        if (sortBy === "code") return a.code.localeCompare(b.code, undefined, { numeric: true });
        if (sortBy === "confidence") return confidenceWeight(a.confidence) - confidenceWeight(b.confidence);
        if (sortBy === "product") return a.product.localeCompare(b.product) || a.code.localeCompare(b.code);
        return b.searchScore - a.searchScore || sourceRank(a) - sourceRank(b) || a.code.localeCompare(b.code, undefined, { numeric: true });
      });
  }, [errorEntries, reviewedSources, query, product, version, source, confidence, fixStatus, scenarioFilter, researchFilter, validationFilter, reviewStatusFilter, sortBy]);

  const selectedSummary = selectedId ? errorEntries.find((entry) => entry.id === selectedId) : null;
  const latestSourceDate = useMemo(
    () => reviewedSources.map((item) => item.reviewedDate).filter(Boolean).sort().at(-1),
    [reviewedSources],
  );

  useEffect(() => {
    if (!catalog || !selectedId) return;
    if (!filteredEntries.some((entry) => entry.id === selectedId)) setSelectedId(null);
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
  }

  async function shareEntry(entry) {
    const shareUrl = errorShareUrl(entry.id);
    await copyToClipboard(shareUrl);
    setNotification(`Copied link for ${entry.code}.`);
    setUsageStats(recordUsageEvent("shares"));
  }

  function focusValidationQueue() {
    setConfidence("Needs validation");
    setResearchFilter("needs-fix-research");
    setValidationFilter("source-research-needed");
    setReviewStatusFilter(allOption);
    setSortBy("confidence");
    setSelectedId(null);
    setIsMoreFiltersOpen(true);
    setUsageStats(recordUsageEvent("filters"));
  }

  function focusGuidedFixes() {
    setConfidence(allOption);
    setResearchFilter("has-fix-guidance");
    setFixStatus(allOption);
    setReviewStatusFilter(allOption);
    setSortBy("relevance");
    setSelectedId(null);
    setUsageStats(recordUsageEvent("filters"));
  }

  function focusScenarios() {
    setScenarioFilter("has-scenarios");
    setReviewStatusFilter(allOption);
    setSelectedId(null);
    setIsMoreFiltersOpen(true);
    setUsageStats(recordUsageEvent("filters"));
  }

  function focusUnresolved() {
    setConfidence(allOption);
    setFixStatus("unresolved");
    setResearchFilter("needs-fix-research");
    setValidationFilter(allOption);
    setReviewStatusFilter(allOption);
    setSortBy("confidence");
    setSelectedId(null);
    setIsMoreFiltersOpen(true);
    setUsageStats(recordUsageEvent("filters"));
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

  const displayedReviewedSources = reviewedSources.filter(
    (sourceItem) =>
      (ledgerSource === allOption || sourceItem.sourceType === ledgerSource) &&
      (reviewStatusFilter === allOption || sourceItem.reviewStatus === reviewStatusFilter),
  );
  const ledgerRows = isLedgerExpanded ? displayedReviewedSources : displayedReviewedSources.slice(0, 5);
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
            <h1>Laserfiche Error Helper</h1>
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
            This community research aid is for read-only reporting, troubleshooting, and education. It is not
            affiliated with or endorsed by Laserfiche. Manually modifying Laserfiche databases is unsupported and
            violates your support plan; validate changes in a test environment.{" "}
            <a href="https://github.com/SilhouetteBS/LaserficheErrorHelper/blob/main/docs/known-limitations.md" rel="noreferrer" target="_blank">
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

        <section className="quality-panel" aria-label="Research and validation shortcuts">
          <div>
            <span className="selected-label">Research focus</span>
            <h2>Improve trust by validating uncertain entries.</h2>
          </div>
          <button type="button" onClick={focusValidationQueue}>
            <strong>{qualitySummary.needsSourceResearch}</strong>
            <span>Need source research</span>
          </button>
          <button type="button" onClick={focusGuidedFixes}>
            <strong>{qualitySummary.hasGuidance}</strong>
            <span>Have fix guidance</span>
          </button>
          <button type="button" onClick={focusScenarios}>
            <strong>{qualitySummary.scenarioEntries}</strong>
            <span>Multiple scenarios</span>
          </button>
          <button type="button" onClick={focusUnresolved}>
            <strong>{qualitySummary.unresolvedEntries}</strong>
            <span>Needs review</span>
          </button>
          <span className="quality-note">
            {qualitySummary.lowConfidence} low-confidence entries remain visible for discovery; {qualitySummary.hasGuidance} entries have a known fix or workaround.
          </span>
        </section>

      <section className="workspace">
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
                          <small>{entry.summary}</small>
                        </span>
                        <span className="result-badges">
                          <CandidateStatusBadge entryId={entry.id} sourceCandidateReviews={sourceCandidateReviews} />
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
          <ErrorDetail
            entry={selectedDetail}
            allEntries={errorEntries}
            reviewedSources={reviewedSources}
            sourceCandidateReviews={sourceCandidateReviews}
            onSelect={selectEntry}
            onShare={shareEntry}
          />
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

      <section className="ledger-panel" aria-label="Reviewed source ledger">
        <div className="ledger-heading">
          <div>
            <h2>Reviewed Source Ledger</h2>
            <span>{reviewedSources.length} sources</span>
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

function SourceBadge({ sourceType }) {
  const labels = {
    "official-docs": "Official Docs",
    "support-knowledge-base": "Support Knowledge Base",
    "answers-laserfiche-employee": "Answers - Laserfiche Employee",
    "answers-community-confirmed": "Answers - Community Confirmed",
    "answers-community": "Answers - Community",
  };
  return <span className={`source-badge ${sourceType}`}>{labels[sourceType] ?? sourceType}</span>;
}

function CandidateStatusBadge({ entryId, sourceCandidateReviews }) {
  const summary = candidateReviewSummary(entryId, sourceCandidateReviews);
  if (!summary) return null;

  return <span className={`candidate-status ${summary.className}`}>{summary.label}</span>;
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

function ErrorDetail({ entry, allEntries, reviewedSources, sourceCandidateReviews, onSelect, onShare }) {
  const candidateSummary = candidateReviewSummary(entry.id, sourceCandidateReviews);
  const sameCodeEntries = allEntries
    .filter((candidate) => candidate.id !== entry.id && normalizeCode(candidate.code) === normalizeCode(entry.code))
    .sort((a, b) => a.product.localeCompare(b.product) || fixStatusValue(a).localeCompare(fixStatusValue(b)) || a.message.localeCompare(b.message))
    .slice(0, 8);

  return (
    <article className="detail-pane">
      <div className="detail-main">
        <div className="detail-header">
          <div className="detail-title-block">
            <span className="selected-label">Selected error</span>
            {entry.scenarios?.length > 0 && <span className="scenario-count detail-scenario-count">{entry.scenarios.length} scenarios</span>}
            {candidateSummary && (
              <span className={`candidate-status ${candidateSummary.className}`}>
                {candidateSummary.label}
                <TooltipIcon text="A related Laserfiche Answers source was reviewed for this entry. Accepted candidates may add scenario-specific fixes; reviewed candidates may simply rule out a source." />
              </span>
            )}
            <h2>{entry.code}</h2>
          </div>
          <div className="detail-actions">
            <button onClick={() => onShare(entry)} type="button">
              <Share2 aria-hidden="true" size={17} />
              Share
            </button>
            <a href={correctionIssueUrl(entry)} rel="noreferrer" target="_blank">
              <MessageSquarePlus aria-hidden="true" size={20} />
              Report Correction
            </a>
          </div>
        </div>
        <p className="error-description">{entry.message}</p>

        <div className="meta-strip">
          <span>
            <strong>Product</strong>
            {entry.product}
          </span>
          <span>
            <strong>Versions</strong>
            {entry.versions.join(", ")}
          </span>
          <span>
            <strong>Last Reviewed</strong>
            {entry.reviewedDate}
          </span>
        </div>

        <DetailSection title="Symptoms" icon={Stethoscope}>
          <ul>
            {entry.symptoms.map((symptom) => (
              <li key={symptom}>{symptom}</li>
            ))}
          </ul>
        </DetailSection>

        <DetailSection
          title="Likely Fixes"
          icon={Wrench}
          tooltip="These are source-backed or diagnostic next steps. Validate them in a test or maintenance window before changing production."
        >
          <ol>
            {entry.likelyFixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ol>
        </DetailSection>

        {entry.scenarios?.length > 0 && (
          <DetailSection title="Possible Scenarios">
            <div className="scenario-list">
              {entry.scenarios.map((scenario) => (
                <section className="scenario-card" key={scenario.title}>
                  <div className="scenario-heading">
                    <div>
                      <h4>{scenario.title}</h4>
                      {scenario.summary && <p>{scenario.summary}</p>}
                    </div>
                    {scenario.versions?.length > 0 && (
                      <span className="scenario-versions">{scenario.versions.join(", ")}</span>
                    )}
                  </div>
                  <ScenarioList title="Symptoms" items={scenario.symptoms} />
                  <ScenarioList title="Likely Causes" items={scenario.causes} />
                  <ScenarioList title="Fixes / Next Steps" items={scenario.fixes} ordered />
                  {scenario.sourceUrls?.length > 0 && (
                    <div className="scenario-sources">
                      <strong>Scenario sources</strong>
                      <ul>
                        {scenario.sourceUrls.map((url) => {
                          const sourceItem = entry.sources.find((source) => source.url === url);
                          return (
                            <li key={url}>
                              {sourceItem ? (
                                <a href={url} rel="noreferrer" target="_blank">
                                  {sourceItem.title}
                                </a>
                              ) : (
                                <a href={url} rel="noreferrer" target="_blank">
                                  {url}
                                </a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </DetailSection>
        )}

      </div>

      <aside className="detail-sidebar" aria-label="Evidence and source details">
        <section className="side-card">
          <h3 className="with-tooltip">
            Source Confidence
            <TooltipIcon text="Confidence is based on source authority, whether a Laserfiche employee replied, and whether the fix was confirmed." />
          </h3>
          <ConfidenceBadge value={entry.confidence} />
          <p>{entry.summary}</p>
        </section>
        <section className="side-card">
          <h3 className="with-tooltip">
            Fix Status
            <TooltipIcon text="Known fix means a source confirms a fix. Workaround means source-backed remediation exists but may not be permanent. Diagnostic only and unresolved entries are useful for discovery but need more evidence." />
          </h3>
          <FixStatusBadge value={fixStatusValue(entry)} />
          <p>
            {fixStatusValue(entry) === "known-fix" &&
              "A source-backed fix is documented for at least one matching scenario."}
            {fixStatusValue(entry) === "workaround" &&
              "A source-backed workaround is documented, but it may not be a permanent product fix."}
            {fixStatusValue(entry) === "diagnostic-only" &&
              "Sources provide troubleshooting direction, but no single confirmed fix is documented."}
            {fixStatusValue(entry) === "unresolved" &&
              "The error is documented, but no confirmed public fix has been identified yet."}
            {fixStatusValue(entry) === "needs-review" &&
              "This entry needs additional source review before a fix status can be assigned."}
          </p>
        </section>
        <section className="side-card">
          <h3 className="with-tooltip">
            Validation Status
            <TooltipIcon text="Validation status tracks research maturity for this helper. It does not mean the Laserfiche error itself is invalid or unsupported." />
          </h3>
          <span className={`validation-status ${entry.validationStatus ?? "not-triaged"}`}>
            {validationStatusLabel(entry.validationStatus)}
          </span>
          <p>{validationStatusDescription(entry.validationStatus)}</p>
          {candidateSummary && (
            <p>
              {candidateSummary.count} reviewed candidate source{candidateSummary.count === 1 ? "" : "s"} matched this entry.
            </p>
          )}
        </section>
        <section className="side-card">
          <h3 className="with-tooltip">
            Source Priority
            <TooltipIcon text="Official docs rank first, Laserfiche employee Answers posts rank next, and community-confirmed sources rank after that." />
          </h3>
          <ol className="priority-list">
            {[...entry.sources]
              .sort((a, b) => (sourcePriority[a.sourceType] ?? 99) - (sourcePriority[b.sourceType] ?? 99))
              .map((sourceItem) => (
                <li key={`${sourceItem.sourceType}-${sourceItem.title}`}>
                  <span>{sourceTypeLabel(sourceItem.sourceType)}</span>
                  <span className="check-dot">
                    <Check aria-hidden="true" size={11} strokeWidth={3.5} />
                  </span>
                </li>
              ))}
          </ol>
        </section>
        <section className="side-card">
          <h3>Links to Sources</h3>
          <div className="source-list">
            {entry.sources.map((sourceItem, index) => (
              <a
                className="source-card"
                href={sourceItem.url}
                key={`${sourceItem.sourceType}-${sourceItem.url}-${index}`}
                rel="noreferrer"
                target="_blank"
              >
                <span className="source-card-content">
                  <span>{sourceItem.title}</span>
                  <span className="source-card-meta">
                    <SourceBadge sourceType={sourceItem.sourceType} />
                    <ReviewStatusBadge value={sourceReviewStatusFor(sourceItem, reviewedSources)} />
                  </span>
                </span>
                <ExternalLink aria-hidden="true" size={16} />
              </a>
            ))}
          </div>
        </section>
        {sameCodeEntries.length > 0 && (
          <section className="side-card">
            <h3 className="with-tooltip">
              Same Code, Other Contexts
              <TooltipIcon text="The same numeric or product code can have different causes and fixes depending on product, version, and source context." />
            </h3>
            <div className="same-code-list">
              {sameCodeEntries.map((relatedEntry) => (
                <button key={relatedEntry.id} onClick={() => onSelect(relatedEntry.id)} type="button">
                  <span>
                    <strong>{relatedEntry.product}</strong>
                    {relatedEntry.message}
                  </span>
                  <FixStatusBadge value={fixStatusValue(relatedEntry)} />
                </button>
              ))}
            </div>
          </section>
        )}
        {entry.notes && (
          <div className="caution">
            <AlertTriangle aria-hidden="true" size={18} />
            <p>{entry.notes}</p>
          </div>
        )}
      </aside>
    </article>
  );
}

function DetailSection({ title, children, icon: Icon = BookOpen, tooltip }) {
  return (
    <section className="detail-section">
      <div className="section-label">
        <Icon aria-hidden="true" size={17} />
        <h3>{title}</h3>
        {tooltip && <TooltipIcon text={tooltip} />}
      </div>
      {children}
    </section>
  );
}

function ScenarioList({ title, items = [], ordered = false }) {
  if (!items.length) return null;

  const ListTag = ordered ? "ol" : "ul";

  return (
    <div className="scenario-block">
      <strong>{title}</strong>
      <ListTag>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ListTag>
    </div>
  );
}

const rootElement = document.getElementById("root");
const appRoot = window.__ficheBaitErrorHelperRoot ?? createRoot(rootElement);
window.__ficheBaitErrorHelperRoot = appRoot;
appRoot.render(<App />);


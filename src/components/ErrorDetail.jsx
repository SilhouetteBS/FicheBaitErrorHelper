import { Fragment, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ExternalLink,
  GitBranch,
  MessageSquarePlus,
  MessageSquareReply,
  Share2,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { answersContributionTargets, isAnswersUrl } from "../answersContribution.js";
import { normalizeCode } from "../search.js";
import {
  fixStatusMetadata,
  reviewStatusMetadata,
  statusLabel,
  validationStatusMetadata,
} from "../statusMetadata.js";
import { TooltipIcon } from "./TooltipIcon.jsx";
import { AnswersContributionDialog } from "./AnswersContributionDialog.jsx";

function fixStatusValue(entry) {
  if (entry.fixStatus) return entry.fixStatus;
  if (entry.confidence === "low") return "needs-review";
  return "diagnostic-only";
}

function breakableCode(code) {
  return code.split(/([_-])/).map((part, index) => (
    <Fragment key={`${index}-${part}`}>
      {part}
      {/[_-]/.test(part) && <wbr />}
    </Fragment>
  ));
}

function candidateReviewSummary(entryId, reviewsByEntry) {
  const reviews = reviewsByEntry.get(entryId) ?? [];
  if (reviews.length === 0) return null;
  const accepted = reviews.filter((review) => review.disposition.startsWith("accepted-")).length;
  if (accepted > 0) return { label: "Candidate source found", className: "candidate-found", count: accepted };
  return { label: "Candidate reviewed", className: "candidate-reviewed", count: reviews.length };
}

function correctionIssueUrl(entry) {
  const liveUrl = new URL(window.location.href);
  liveUrl.search = "";
  liveUrl.searchParams.set("error", entry.id);
  const params = new URLSearchParams({
    template: "error-report.yml",
    title: `[Error entry]: ${entry.code} - ${entry.product}`,
    code: `${entry.code} - ${entry.message}`,
    product: entry.product,
    version: entry.versions.join(", "),
    symptoms: `Entry ID: ${entry.id}\nLive URL: ${liveUrl}\n\nDescribe what is incorrect or missing:`,
    source: entry.sources[0]?.url ?? liveUrl.toString(),
  });
  return `https://github.com/SilhouetteBS/FicheBaitErrorHelper/issues/new?${params}`;
}

function ConfidenceBadge({ value }) {
  const label = value === "high" ? "High confidence" : value === "medium" ? "Medium confidence" : "Needs validation";
  return <span className={`confidence ${value}`}>{label}</span>;
}

function FixStatusBadge({ value }) {
  return <span className={`fix-status ${value}`}>{statusLabel(fixStatusMetadata, value, "Needs review")}</span>;
}

function ReviewStatusBadge({ value }) {
  return <span className={`review-status ${value}`}>{statusLabel(reviewStatusMetadata, value)}</span>;
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

function DetailSection({ title, children, icon: Icon = BookOpen, tooltip, variant = "neutral" }) {
  return (
    <section className={`detail-section detail-section-${variant}`}>
      <div className="section-label">
        <Icon aria-hidden="true" size={17} />
        <h3>{title}</h3>
        {tooltip && <TooltipIcon text={tooltip} />}
      </div>
      {children}
    </section>
  );
}

function ScenarioList({ title, items = [], ordered = false, variant = "neutral" }) {
  if (!items.length) return null;
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div className={`scenario-block scenario-block-${variant}`}>
      <strong>{title}</strong>
      <ListTag>{items.map((item) => <li key={item}>{item}</li>)}</ListTag>
    </div>
  );
}

function resolutionPaths(entry) {
  if (!entry.scenarios?.length) {
    return [{
      title: "General troubleshooting guidance",
      summary: "Entry-level guidance synthesized from the reviewed evidence listed with this path.",
      versions: entry.versions,
      symptoms: [],
      causes: [],
      fixes: entry.likelyFixes,
      sources: entry.sources,
      general: true,
    }];
  }

  const scenarioPaths = entry.scenarios.map((scenario) => ({
    ...scenario,
    versions: scenario.versions?.length ? scenario.versions : entry.versions,
    sources: (scenario.sourceUrls ?? [])
      .map((url) => entry.sources.find((source) => source.url === url))
      .filter(Boolean),
  }));

  return [
    ...scenarioPaths,
    {
      title: "General diagnostic checklist",
      summary: "Cross-scenario guidance retained from the entry-level research. Review the evidence before applying a step to a specific environment.",
      versions: entry.versions,
      symptoms: [],
      causes: [],
      fixes: entry.likelyFixes,
      sources: entry.sources,
      general: true,
    },
  ];
}

function PathEvidence({ sources, reviewedSources, onContribute, title = "Evidence for this path" }) {
  if (!sources.length) return <p className="path-evidence-empty">No path-specific source has been assigned yet.</p>;

  return (
    <div className="path-evidence">
      {title && <div className="path-evidence-title"><BookOpen aria-hidden="true" size={15} /><strong>{title}</strong></div>}
      <div className="path-evidence-list">{sources.map((sourceItem, index) => (
        <div className="path-evidence-row" key={`${sourceItem.url}-${index}`}>
          <span className="evidence-index">[{index + 1}]</span>
          <a href={sourceItem.url} rel="noreferrer" target="_blank">
            <span>{sourceItem.title}</span><ExternalLink aria-hidden="true" size={15} />
          </a>
          <span className="source-card-meta">
            <SourceBadge sourceType={sourceItem.sourceType} />
            <ReviewStatusBadge value={reviewedSources.get(sourceItem.url) ?? "curated"} />
          </span>
          {isAnswersUrl(sourceItem.url) && (
            <button
              className="answers-contribution-button"
              onClick={() => onContribute(sourceItem)}
              type="button"
            >
              <MessageSquareReply aria-hidden="true" size={15} />Share outcome
            </button>
          )}
        </div>
      ))}</div>
    </div>
  );
}

function ResolutionPath({ path, defaultOpen, reviewedSources, onContribute }) {
  const body = (
    <div className="resolution-path-body">
      <div className="resolution-columns">
        <ScenarioList title="Matching Symptoms" items={path.symptoms} variant="symptoms" />
        <ScenarioList title="Likely Causes" items={path.causes} variant="causes" />
        <ScenarioList title="Fixes / Next Steps" items={path.fixes} ordered variant="fixes" />
      </div>
      <PathEvidence
        onContribute={(source) => onContribute(source, path.general ? null : path)}
        reviewedSources={reviewedSources}
        sources={path.sources}
      />
    </div>
  );

  const heading = (
    <>
      <span><strong>{path.title}</strong>{path.summary && <small>{path.summary}</small>}</span>
      {path.versions?.length > 0 && <span className="resolution-versions">Applies to: {path.versions.join(", ")}</span>}
    </>
  );

  if (defaultOpen) {
    return <section className="resolution-path open"><div className="resolution-path-heading">{heading}</div>{body}</section>;
  }

  return <details className="resolution-path"><summary className="resolution-path-heading">{heading}<ChevronRight aria-hidden="true" className="resolution-toggle" size={18} /></summary>{body}</details>;
}

export function ErrorDetail({ entry, allEntries, reviewedSources, sourceCandidateReviews, onSelect, onShare, onBack }) {
  const [contributionTarget, setContributionTarget] = useState(null);
  const candidateSummary = candidateReviewSummary(entry.id, sourceCandidateReviews);
  const contributionTargets = answersContributionTargets(entry);
  const paths = resolutionPaths(entry);
  const sameCodeEntries = allEntries
    .filter((candidate) => candidate.id !== entry.id && normalizeCode(candidate.code) === normalizeCode(entry.code))
    .sort((a, b) => a.product.localeCompare(b.product) || fixStatusValue(a).localeCompare(fixStatusValue(b)) || a.message.localeCompare(b.message))
    .slice(0, 8);

  return (
    <article className="detail-pane">
      <div className="detail-main">
        <button className="mobile-back-button" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={18} />
          Back to results
        </button>
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
            <h2>{breakableCode(entry.code)}</h2>
          </div>
          <div className="detail-actions">
            <button onClick={() => onShare(entry)} type="button"><Share2 aria-hidden="true" size={17} />Share</button>
            {contributionTargets.length > 0 && (
              <button
                className="answers-primary-action"
                onClick={() => setContributionTarget(contributionTargets)}
                type="button"
              >
                <MessageSquareReply aria-hidden="true" size={17} />Contribute on Answers
              </button>
            )}
            <a href={correctionIssueUrl(entry)} rel="noreferrer" target="_blank"><MessageSquarePlus aria-hidden="true" size={20} />Report Correction</a>
          </div>
        </div>
        <p className="error-description">{entry.message}</p>
        <div className="entry-facts">
          <div><strong>Product</strong><span>{entry.product}</span></div>
          <div><strong>Versions</strong><span>{entry.versions.join(", ")}</span></div>
          <div><strong>Last Reviewed</strong><span>{entry.reviewedDate}</span></div>
          <div>
            <strong className="with-tooltip">Source Confidence<TooltipIcon text="Confidence is based on source authority, whether a Laserfiche employee replied, and whether the fix was confirmed." /></strong>
            <ConfidenceBadge value={entry.confidence} />
          </div>
          <div>
            <strong className="with-tooltip">Fix Status<TooltipIcon text="Known fix means a source confirms a fix. Workaround means source-backed remediation exists but may not be permanent. Diagnostic only and unresolved entries are useful for discovery but need more evidence." /></strong>
            <FixStatusBadge value={fixStatusValue(entry)} />
          </div>
          <div>
            <strong className="with-tooltip">Validation Status<TooltipIcon text="Validation status tracks research maturity for this helper. It does not mean the Laserfiche error itself is invalid or unsupported." /></strong>
            <span className={`validation-status ${entry.validationStatus ?? "not-triaged"}`}>{statusLabel(validationStatusMetadata, entry.validationStatus, "Not triaged")}</span>
          </div>
        </div>
        <p className="entry-summary">{entry.summary}</p>
        <DetailSection title="Symptoms" icon={Stethoscope} variant="symptoms">
          <ul>{entry.symptoms.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul>
        </DetailSection>
        <DetailSection title="Resolution Paths" icon={Wrench} tooltip="Each path groups symptoms, causes, fixes, and the reviewed evidence that applies to that troubleshooting context." variant="resolution">
          <div className="resolution-list">{paths.map((path, index) => (
            <ResolutionPath
              defaultOpen={index === 0}
              key={`${path.title}-${index}`}
              onContribute={(source, scenario) => setContributionTarget([{ source, scenario }])}
              path={path}
              reviewedSources={reviewedSources}
            />
          ))}</div>
        </DetailSection>
        <details className="all-reviewed-sources">
          <summary><BookOpen aria-hidden="true" size={17} /><span className="disclosure-label">All Reviewed Sources</span><span className="disclosure-count">{entry.sources.length}</span></summary>
          <PathEvidence
            onContribute={(source) => setContributionTarget([{ source, scenario: null }])}
            reviewedSources={reviewedSources}
            sources={entry.sources}
            title=""
          />
        </details>
        {sameCodeEntries.length > 0 && (
          <DetailSection title="Same Code, Other Contexts" icon={GitBranch} tooltip="The same numeric or product code can have different causes and fixes depending on product, version, and source context." variant="related">
            <div className="same-code-list">{sameCodeEntries.map((relatedEntry) => (
              <button key={relatedEntry.id} onClick={() => onSelect(relatedEntry.id)} type="button"><span><strong>{relatedEntry.product}</strong>{relatedEntry.message}</span><FixStatusBadge value={fixStatusValue(relatedEntry)} /></button>
            ))}</div>
          </DetailSection>
        )}
        {entry.notes && <div className="caution"><AlertTriangle aria-hidden="true" size={18} /><p>{entry.notes}</p></div>}
      </div>
      {contributionTarget && (
        <AnswersContributionDialog
          correctionUrl={correctionIssueUrl(entry)}
          entry={entry}
          onClose={() => setContributionTarget(null)}
          targets={contributionTarget}
        />
      )}
    </article>
  );
}

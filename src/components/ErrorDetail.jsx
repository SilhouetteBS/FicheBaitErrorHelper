import { Fragment, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ExternalLink,
  MessageSquarePlus,
  MessageSquareReply,
  Share2,
  Stethoscope,
  Wrench,
} from "lucide-react";
import { isAnswersUrl } from "../answersContribution.js";
import { sourcePriority, sourceTypeOptions } from "../data/catalogMetadata.js";
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

function sourceTypeLabel(sourceType) {
  return sourceTypeOptions.find((option) => option.value === sourceType)?.label ?? sourceType;
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
      <ListTag>{items.map((item) => <li key={item}>{item}</li>)}</ListTag>
    </div>
  );
}

export function ErrorDetail({ entry, allEntries, reviewedSources, sourceCandidateReviews, onSelect, onShare, onBack }) {
  const [contributionTarget, setContributionTarget] = useState(null);
  const candidateSummary = candidateReviewSummary(entry.id, sourceCandidateReviews);
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
            <a href={correctionIssueUrl(entry)} rel="noreferrer" target="_blank"><MessageSquarePlus aria-hidden="true" size={20} />Report Correction</a>
          </div>
        </div>
        <p className="error-description">{entry.message}</p>
        <div className="meta-strip">
          <span><strong>Product</strong>{entry.product}</span>
          <span><strong>Versions</strong>{entry.versions.join(", ")}</span>
          <span><strong>Last Reviewed</strong>{entry.reviewedDate}</span>
        </div>
        <DetailSection title="Symptoms" icon={Stethoscope}>
          <ul>{entry.symptoms.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul>
        </DetailSection>
        <DetailSection title="Likely Fixes" icon={Wrench} tooltip="These are source-backed or diagnostic next steps. Validate them in a test or maintenance window before changing production.">
          <ol>{entry.likelyFixes.map((fix) => <li key={fix}>{fix}</li>)}</ol>
        </DetailSection>
        {entry.scenarios?.length > 0 && (
          <DetailSection title="Possible Scenarios">
            <div className="scenario-list">
              {entry.scenarios.map((scenario) => (
                <section className="scenario-card" key={scenario.title}>
                  <div className="scenario-heading">
                    <div><h4>{scenario.title}</h4>{scenario.summary && <p>{scenario.summary}</p>}</div>
                    {scenario.versions?.length > 0 && <span className="scenario-versions">{scenario.versions.join(", ")}</span>}
                  </div>
                  <ScenarioList title="Symptoms" items={scenario.symptoms} />
                  <ScenarioList title="Likely Causes" items={scenario.causes} />
                  <ScenarioList title="Fixes / Next Steps" items={scenario.fixes} ordered />
                  {scenario.sourceUrls?.length > 0 && (
                    <div className="scenario-sources">
                      <strong>Scenario sources</strong>
                      <ul>{scenario.sourceUrls.map((url) => {
                        const sourceItem = entry.sources.find((source) => source.url === url);
                        return (
                          <li key={url}>
                            <a href={url} rel="noreferrer" target="_blank">{sourceItem?.title ?? url}</a>
                            {isAnswersUrl(url) && (
                              <button
                                className="answers-contribution-button"
                                onClick={() => setContributionTarget({ source: sourceItem ?? { title: url, url }, scenario })}
                                type="button"
                              >
                                <MessageSquareReply aria-hidden="true" size={15} />Share outcome
                              </button>
                            )}
                          </li>
                        );
                      })}</ul>
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
          <h3 className="with-tooltip">Source Confidence<TooltipIcon text="Confidence is based on source authority, whether a Laserfiche employee replied, and whether the fix was confirmed." /></h3>
          <ConfidenceBadge value={entry.confidence} /><p>{entry.summary}</p>
        </section>
        <section className="side-card">
          <h3 className="with-tooltip">Fix Status<TooltipIcon text="Known fix means a source confirms a fix. Workaround means source-backed remediation exists but may not be permanent. Diagnostic only and unresolved entries are useful for discovery but need more evidence." /></h3>
          <FixStatusBadge value={fixStatusValue(entry)} />
          <p>{({
            "known-fix": "A source-backed fix is documented for at least one matching scenario.",
            workaround: "A source-backed workaround is documented, but it may not be a permanent product fix.",
            "diagnostic-only": "Sources provide troubleshooting direction, but no single confirmed fix is documented.",
            unresolved: "The error is documented, but no confirmed public fix has been identified yet.",
            "needs-review": "This entry needs additional source review before a fix status can be assigned.",
          })[fixStatusValue(entry)]}</p>
        </section>
        <section className="side-card">
          <h3 className="with-tooltip">Validation Status<TooltipIcon text="Validation status tracks research maturity for this helper. It does not mean the Laserfiche error itself is invalid or unsupported." /></h3>
          <span className={`validation-status ${entry.validationStatus ?? "not-triaged"}`}>{statusLabel(validationStatusMetadata, entry.validationStatus, "Not triaged")}</span>
          <p>{validationStatusMetadata[entry.validationStatus]?.description ?? "This entry has not been included in a validation triage pass yet."}</p>
          {candidateSummary && <p>{candidateSummary.count} reviewed candidate source{candidateSummary.count === 1 ? "" : "s"} matched this entry.</p>}
        </section>
        <section className="side-card">
          <h3 className="with-tooltip">Source Priority<TooltipIcon text="Official docs rank first, Laserfiche employee Answers posts rank next, and community-confirmed sources rank after that." /></h3>
          <ol className="priority-list">{[...entry.sources]
            .sort((a, b) => (sourcePriority[a.sourceType] ?? 99) - (sourcePriority[b.sourceType] ?? 99))
            .map((sourceItem) => <li key={`${sourceItem.sourceType}-${sourceItem.title}`}><span>{sourceTypeLabel(sourceItem.sourceType)}</span><span className="check-dot"><Check aria-hidden="true" size={11} strokeWidth={3.5} /></span></li>)}</ol>
        </section>
        <section className="side-card">
          <h3>Links to Sources</h3>
          <div className="source-list">{entry.sources.map((sourceItem, index) => (
            <div className="source-card-row" key={`${sourceItem.sourceType}-${sourceItem.url}-${index}`}>
              <a className="source-card" href={sourceItem.url} rel="noreferrer" target="_blank">
                <span className="source-card-content"><span>{sourceItem.title}</span><span className="source-card-meta"><SourceBadge sourceType={sourceItem.sourceType} /><ReviewStatusBadge value={reviewedSources.get(sourceItem.url) ?? "curated"} /></span></span>
                <ExternalLink aria-hidden="true" size={16} />
              </a>
              {isAnswersUrl(sourceItem.url) && (
                <button
                  className="answers-contribution-button"
                  onClick={() => setContributionTarget({ source: sourceItem, scenario: null })}
                  type="button"
                >
                  <MessageSquareReply aria-hidden="true" size={15} />Share outcome on Answers
                </button>
              )}
            </div>
          ))}</div>
        </section>
        {sameCodeEntries.length > 0 && (
          <section className="side-card">
            <h3 className="with-tooltip">Same Code, Other Contexts<TooltipIcon text="The same numeric or product code can have different causes and fixes depending on product, version, and source context." /></h3>
            <div className="same-code-list">{sameCodeEntries.map((relatedEntry) => (
              <button key={relatedEntry.id} onClick={() => onSelect(relatedEntry.id)} type="button"><span><strong>{relatedEntry.product}</strong>{relatedEntry.message}</span><FixStatusBadge value={fixStatusValue(relatedEntry)} /></button>
            ))}</div>
          </section>
        )}
        {entry.notes && <div className="caution"><AlertTriangle aria-hidden="true" size={18} /><p>{entry.notes}</p></div>}
      </aside>
      {contributionTarget && (
        <AnswersContributionDialog
          correctionUrl={correctionIssueUrl(entry)}
          entry={entry}
          onClose={() => setContributionTarget(null)}
          scenario={contributionTarget.scenario}
          source={contributionTarget.source}
        />
      )}
    </article>
  );
}

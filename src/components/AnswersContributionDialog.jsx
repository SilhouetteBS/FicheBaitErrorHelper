import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageSquareReply, X } from "lucide-react";
import {
  answersOutcomeOptions,
  answersTargetLabel,
  buildAnswersReply,
} from "../answersContribution.js";

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function AnswersContributionDialog({ entry, targets, correctionUrl, onClose }) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [outcome, setOutcome] = useState("resolved");
  const [versionBuild, setVersionBuild] = useState("");
  const [context, setContext] = useState("");
  const [status, setStatus] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const { source, scenario } = targets[targetIndex];

  const reply = useMemo(
    () => buildAnswersReply({ entry, source, scenario, outcome, versionBuild, context }),
    [context, entry, outcome, scenario, source, versionBuild],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [
        ...dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    window.open(source.url, "_blank", "noopener,noreferrer");
    try {
      await copyToClipboard(reply);
      setStatus("Response copied. Paste it into the Answers reply editor.");
    } catch {
      setStatus("Answers opened, but the response could not be copied. Copy it from the preview below.");
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="answers-contribution-title"
        aria-modal="true"
        className="info-dialog answers-contribution-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <div>
            <span className="dialog-eyebrow">Laserfiche Answers</span>
            <h2 id="answers-contribution-title">Share a troubleshooting outcome</h2>
          </div>
          <button aria-label="Close dialog" onClick={onClose} ref={closeButtonRef} type="button">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <form className="answers-contribution-form" onSubmit={handleSubmit}>
          {targets.length > 1 && (
            <label>
              Answers discussion or scenario
              <select
                onChange={(event) => {
                  setTargetIndex(Number(event.target.value));
                  setStatus("");
                }}
                value={targetIndex}
              >
                {targets.map((target, index) => (
                  <option key={`${target.source.url}-${target.scenario?.title ?? "general"}`} value={index}>
                    {answersTargetLabel(target)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="answers-source-context">
            <strong>{scenario?.title ?? entry.code}</strong>
            <span>{source.title}</span>
          </div>

          <label>
            Outcome
            <select onChange={(event) => setOutcome(event.target.value)} value={outcome}>
              {answersOutcomeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Laserfiche version and build
            <input
              onChange={(event) => setVersionBuild(event.target.value)}
              placeholder="Example: 12.0.1 build 1234"
              required
              value={versionBuild}
            />
          </label>

          <label>
            Additional relevant details
            <textarea
              onChange={(event) => setContext(event.target.value)}
              placeholder="Describe what was tested and what happened. Remove private or customer-identifying information."
              rows={4}
              value={context}
            />
          </label>

          <div className="answers-reply-preview">
            <span>Response preview</span>
            <pre>{reply}</pre>
          </div>

          <p className="answers-privacy-note">
            Answers requires sign-in, and some older posts may not accept replies. Do not include credentials,
            license details, customer names, private URLs, server names, or repository names.
          </p>

          {status && <p className="answers-copy-status" role="status">{status}</p>}

          <div className="answers-dialog-actions">
            <a href={correctionUrl} rel="noreferrer" target="_blank">Report catalog correction</a>
            <a className="secondary-button" href={source.url} rel="noreferrer" target="_blank">
              Open Answers<ExternalLink aria-hidden="true" size={15} />
            </a>
            <button className="primary-button" type="submit">
              <MessageSquareReply aria-hidden="true" size={17} />Copy response and open Answers
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

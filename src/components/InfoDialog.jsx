import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function InfoDialog({ type, usageStats, qualitySummary, onClose }) {
  const isHow = type === "how";
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

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

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="info-dialog-title"
        aria-modal="true"
        className="info-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <h2 id="info-dialog-title">{isHow ? "How It Works" : "About"}</h2>
          <button aria-label="Close dialog" onClick={onClose} ref={closeButtonRef} type="button">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        {isHow ? (
          <div className="dialog-content">
            <p>
              Search and filters narrow a curated list of Laserfiche self-hosted errors from official
              documentation and reviewed Answers posts.
            </p>
            <ol>
              <li>Official documentation establishes the baseline error code and product context.</li>
              <li>Answers posts add scenario-specific symptoms, fixes, and version notes.</li>
              <li>Laserfiche employee replies are prioritized above community-only guidance.</li>
              <li>Unresolved entries stay visible when they document an error but no confirmed fix exists yet.</li>
            </ol>
          </div>
        ) : (
          <div className="dialog-content">
            <p>
              FicheBait Error Helper is a troubleshooting index for administrators and support teams using self-hosted
              Laserfiche® software.
              It is intended to speed up triage, not replace Laserfiche Support or environment-specific validation.
            </p>
            <p>
              FicheBait Error Helper is not affiliated with or endorsed by Laserfiche. Source links,
              confidence labels, and fix status labels are included so users can validate the original evidence
              before making production changes.
            </p>
            <p>
              Each entry links back to its reviewed sources so users can inspect the original documentation or
              Answers thread before changing a production system.
            </p>
            <p>Laserfiche is a registered trademark of Compulink Management Center, Inc.</p>
            <p>
              Local usage counters on this browser: {usageStats.searches} searches, {usageStats.selections}
              selections, {usageStats.shares} shares, and {usageStats.filters} filter changes. These counters stay
              in local storage and are not sent to a server.
            </p>
            <p>
              Research status: {qualitySummary.needsSourceResearch} entries need source research,{
              " "
              }{qualitySummary.reviewedDiagnostic} are reviewed diagnostic entries, and{
              " "
              }{qualitySummary.officialBaseline} are official-documentation baselines.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

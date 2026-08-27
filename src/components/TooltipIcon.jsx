import React, { useId } from "react";
import { HelpCircle } from "lucide-react";

export function TooltipIcon({ text }) {
  const tooltipId = useId();
  return (
    <button aria-describedby={tooltipId} aria-label="More information" className="tooltip-anchor" type="button">
      <HelpCircle aria-hidden="true" size={15} />
      <span className="tooltip-text" id={tooltipId} role="tooltip">
        {text}
      </span>
    </button>
  );
}

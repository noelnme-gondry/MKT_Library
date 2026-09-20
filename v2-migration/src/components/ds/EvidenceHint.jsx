import React from "react";

import InfoPopover from "./InfoPopover";

export default function EvidenceHint({ label, detail }) {
  return <InfoPopover label={label} className="result-evidence-hint data-confidence-hint">{detail}</InfoPopover>;
}

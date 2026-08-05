import React from "react";

// Hover는 빠른 확인용, native details는 터치·키보드·스크린리더용이다. 툴팁 본문을
// CSS content에만 두지 않아 정보가 접근성 트리에서 사라지지 않는다.
export default function EvidenceHint({ label, detail }) {
  return (
    <details className="result-evidence-hint data-confidence-hint">
      <summary aria-label={label}>ⓘ</summary>
      <span className="data-confidence-hint__tooltip" role="tooltip">{detail}</span>
    </details>
  );
}

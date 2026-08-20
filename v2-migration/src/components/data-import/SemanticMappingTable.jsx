"use client";

import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";

const copy = {
  ko: { title: "Semantic Mapper V2 미리보기", source: "원본 컬럼", role: "전역 역할", decision: "판정", evidence: "근거", unknown: "UNKNOWN · 판단 보류", suggest: "확인 필요", auto: "자동 확정" },
  en: { title: "Semantic Mapper V2 preview", source: "Source column", role: "Canonical role", decision: "Decision", evidence: "Evidence", unknown: "UNKNOWN · abstained", suggest: "Review required", auto: "Auto-confirmed" },
};

const label = (field, locale) => locale === "en" ? field.labelEn : field.label;

export default function SemanticMappingTable({ bindings = [], semanticMapping = null, locale = "ko", onBindingChange }) {
  const t = copy[locale] || copy.ko;
  const candidates = semanticMapping?.candidatesByHeader || {};
  if (!bindings.length) return null;
  return (
    <details className="csv-mapping-block semantic-mapping-block">
      <summary className="csv-mapping-header"><strong className="csv-mapping-title">{t.title}</strong></summary>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t.source}</th><th>{t.role}</th><th>{t.decision}</th><th>{t.evidence}</th></tr></thead>
          <tbody>{bindings.map((binding) => {
            const field = binding.canonicalKey ? CANONICAL_FIELDS[binding.canonicalKey] : null;
            const top = (candidates[binding.sourceColumn] || []).slice(0, 3);
            return <tr key={binding.sourceColumn}>
              <td>{binding.sourceColumn}</td>
              <td><select value={binding.canonicalKey || "__unknown__"} aria-label={`${binding.sourceColumn}: ${t.role}`} onChange={(event) => onBindingChange?.(binding.sourceColumn, event.target.value === "__unknown__" ? null : event.target.value)}>
                <option value="__unknown__">{t.unknown}</option>
                {Object.values(CANONICAL_FIELDS).map((candidate) => <option key={candidate.key} value={candidate.key}>{label(candidate, locale)}</option>)}
              </select></td>
              <td>{binding.decision === "AUTO" ? t.auto : binding.decision === "SUGGEST" ? t.suggest : t.unknown}</td>
              <td>{top.length ? top.map((candidate) => `${label(CANONICAL_FIELDS[candidate.canonicalKey], locale)} (${Math.round(candidate.confidence * 100)}%)`).join(" · ") : field ? label(field, locale) : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </details>
  );
}

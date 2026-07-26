"use client";
import React from "react";

// 결과 숫자 옆에 기술 메타데이터를 항상 펼쳐 두지 않기 위한 공통 상세 패널.
// 결론·상태는 결과 카드에 남기고, 단위·표본수·불확실성·provenance는 details 안에 둔다.
// 이 컴포넌트는 표시층만 담당하며 어떤 분석 엔진도 재실행하거나 저장하지 않는다.

function hasValue(value) {
  return value != null && String(value).trim() !== "";
}

function displayValue(value) {
  if (value == null) return "—";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function MetaItem({ label, value, detail }) {
  if (!hasValue(value)) return null;
  return (
    <div className="analysis-details__item">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
      {hasValue(detail) && <small>{detail}</small>}
    </div>
  );
}

export default function AnalysisDetails({
  locale = "ko",
  statusLabel = "",
  statusTone = "neutral",
  metric = "",
  unit = "",
  meaning = "",
  sampleSize = null,
  interval = null,
  scope = "",
  method = "",
  version = "",
  seed = "",
  cachePolicy = "",
  inputSignature = "",
  filterSummary = "",
  metricDefinition = "",
  warnings = [],
}) {
  const isEn = locale === "en";
  const tr = (ko, en) => (isEn ? en : ko);
  const sample = typeof sampleSize === "object" && sampleSize !== null
    ? sampleSize
    : { value: sampleSize };
  const intervalValue = interval && typeof interval === "object"
    ? (hasValue(interval.value) ? interval.value : `${displayValue(interval.low)}–${displayValue(interval.high)}`)
    : interval;
  const cleanWarnings = (warnings || []).filter(hasValue);
  const hasProvenance = [method, version, seed, cachePolicy, inputSignature, filterSummary, metricDefinition].some(hasValue);

  return (
    <details className={`analysis-details analysis-details--${statusTone}`}>
      <summary>
        <span className="analysis-details__summary-label">ⓘ {tr("신뢰도·방법", "Reliability & method")}</span>
        {hasValue(statusLabel) && <span className="analysis-details__status">{statusLabel}</span>}
      </summary>
      <div className="analysis-details__body">
        <div className="analysis-details__grid">
          <MetaItem
            label={tr("지표", "Metric")}
            value={metric}
            detail={unit ? `${tr("단위", "Unit")}: ${unit}` : ""}
          />
          <MetaItem
            label={tr("해석 범위", "Meaning")}
            value={meaning}
          />
          <MetaItem
            label={sample.label || tr("표본·분모", "Sample / denominator")}
            value={sample.value}
            detail={sample.detail}
          />
          <MetaItem
            label={interval?.label || tr("불확실성", "Uncertainty")}
            value={intervalValue}
            detail={interval?.confidence ? `${interval.confidence} ${tr("구간", "interval")}` : ""}
          />
          <MetaItem label={tr("분석 범위", "Analysis window")} value={scope} />
        </div>

        {cleanWarnings.length > 0 && (
          <ul className="analysis-details__warnings">
            {cleanWarnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        )}

        {hasProvenance && (
          <details className="analysis-details__technical">
            <summary>{tr("실행 정보 보기", "View run details")}</summary>
            <div className="analysis-details__technical-grid">
              <MetaItem label={tr("방법", "Method")} value={method} />
              <MetaItem label={tr("엔진 버전", "Engine version")} value={version} />
              <MetaItem label={tr("시드", "Seed")} value={seed} />
              <MetaItem label={tr("캐시 정책", "Cache policy")} value={cachePolicy} />
              <MetaItem label={tr("입력 식별자", "Input signature")} value={inputSignature} />
              <MetaItem label={tr("필터", "Filter")} value={filterSummary} />
              <MetaItem label={tr("지표 정의", "Metric definition")} value={metricDefinition} />
            </div>
            {(hasValue(seed) || hasValue(cachePolicy)) && (
              <p className="analysis-details__technical-note">
                {tr(
                  "고정 시드는 같은 입력의 재현성을 보장하지만 결과를 저장하지 않습니다. 현재 캐시는 이 브라우저 메모리에서만 유지됩니다.",
                  "A fixed seed makes the same input reproducible; it does not save the result. The current cache stays in this browser's memory only."
                )}
              </p>
            )}
          </details>
        )}
      </div>
    </details>
  );
}

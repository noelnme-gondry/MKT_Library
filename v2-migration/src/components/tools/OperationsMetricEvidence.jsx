"use client";
import { useState } from "react";
import DataTable from "@/components/ds/DataTable";
import { fmtCurrency, fmtNum, fmtPct } from "@/utils/format";

export default function OperationsMetricEvidence({ evidence, currency, locale = "ko", onInspectMapping }) {
  const [selected, setSelected] = useState("cpi");
  const tr = (ko, en) => locale === "en" ? en : ko;
  const metricLabel = metric => metric.id === "cpi" ? evidence.metric === "actions" ? "CPA" : "CPI" : metric.id.toUpperCase();
  const fieldLabel = key => ({ cost: tr("광고비", "Spend"), installs: tr("설치", "Installs"), actions: tr("가입/액션", "Sign-ups/actions"),
    impressions: tr("노출", "Impressions"), clicks: tr("클릭", "Clicks") })[key];
  const reasonLabel = reason => ({
    unmapped: tr("필요한 컬럼 미매핑", "Required column not mapped"),
    conflict: tr("동일 필드에 여러 컬럼 매핑", "Multiple columns mapped to the same field"),
    invalid: tr("결측·음수·유효하지 않은 숫자", "Missing, negative or invalid numbers"),
    empty: tr("기간 내 관측 없음", "No observations in this period"),
    zero_denominator: tr("분모가 0이어서 계산 불가", "Unavailable: zero denominator"),
    invalid_dates: tr("유효하지 않은 날짜의 기간 식별 불가", "Invalid dates cannot be assigned to a period"),
  })[reason];
  const format = metric => metric.value == null ? tr("계산 불가", "Unavailable")
    : metric.unit === "ratio" ? fmtPct(metric.value) : fmtCurrency(metric.value, { currency, precise: true });
  const active = evidence.metrics.find(metric => metric.id === selected) || evidence.metrics[0];
  const root = evidence.metrics.find(metric => metric.id === "cpi");
  const choices = [root, ...evidence.metrics.filter(metric => metric !== root)];
  // % 변환과 천 노출 단위만 표시한다. 결과값은 기존 레지스트리 계산값을 사용한다.
  const displayScale = active.unit === "ratio" ? 100 : active.id === "cpm" ? 1000 : 1;
  const inputColumns = [
    { key: "key", label: tr("사용한 입력", "Input"), fmt: value => <span className="operations-brief__entity"><strong>{fieldLabel(value)}</strong><small>{value}</small></span> },
    { key: "headers", label: tr("원본 CSV 컬럼", "Source CSV columns"), fmt: values => values.length ? values.join(" · ") : tr("미매핑", "Unmapped") },
    { key: "reason", label: tr("계산 상태", "Calculation status"), fmt: (value, row) => value ? <span>{reasonLabel(value)}{row.invalidCount > 0 && <small> · {fmtNum(row.invalidCount)}{tr("행", " rows")}</small>}</span> : tr("유효한 합계", "Complete total") },
  ];
  return <section className="operations-workbench__group operations-metric-evidence" aria-labelledby="ops-inputs-title">
    <header className="operations-brief__heading"><div><h3 id="ops-inputs-title" tabIndex={-1}>{tr("지표와 입력 근거", "Metrics and input evidence")}</h3>
      <p>{tr("지표를 선택해 실제 사용한 컬럼과 계산 상태를 확인하세요.", "Select a metric to inspect its source columns and calculation status.")}</p></div>
      <button type="button" className="btn ghost" onClick={onInspectMapping}>{tr("현재 매핑 확인", "Inspect current mapping")}</button></header>
    <p className="operations-metric-evidence__scope">{evidence.period.start} — {evidence.period.end} · {fmtNum(evidence.observations)}{tr("행 · 현재 공용 필터 기준", " rows · current shared filters")}</p>
    {evidence.invalidDateCount > 0 && <p className="callout" role="status">{tr("날짜를 식별할 수 없는 행이 있어 부분 합계로 계산하지 않았습니다.", "Some dates cannot be identified, so metrics were not calculated from partial totals.")}</p>}
    <div className="operations-metric-evidence__layout">
      <div className="operations-metric-evidence__relationships" role="group" aria-label={tr("산술 지표 선택", "Select an arithmetic metric")}>
        {choices.map(metric => <button key={metric.id} type="button" aria-label={`${metricLabel(metric)} ${format(metric)}`} aria-pressed={active.id === metric.id} aria-controls="ops-input-detail" onClick={() => setSelected(metric.id)}>
          <span>{metricLabel(metric)}</span><strong>{format(metric)}</strong>
        </button>)}
      </div>
      <section id="ops-input-detail" className="operations-metric-evidence__inputs" aria-labelledby="ops-input-detail-title">
        <div className="operations-metric-evidence__result"><h4 id="ops-input-detail-title">{metricLabel(active)} · {tr("입력 내역", "Input details")}</h4><strong>{format(active)}</strong></div>
        <p className="operations-metric-evidence__status" role="status">{active.reason ? reasonLabel(active.reason) : tr("같은 기간·같은 행의 합계로 계산합니다.", "Calculated from totals over the same period and rows.")}</p>
        <div className="operations-metric-evidence__calculation" role="group" aria-label={tr("선택 지표의 계산식", "Calculation for the selected metric")}>
          {active.dependencies.map((input, index) => <div className="operations-metric-evidence__operand" key={input.key}>
            {index > 0 && <span className="operations-metric-evidence__operator" aria-label={tr("나누기", "divided by")}>÷</span>}
            <div><span>{fieldLabel(input.key)} {tr("합계", "total")}{input.key === "cost" && ` (${currency})`}</span><strong>{input.total == null ? tr("계산 불가", "Unavailable") : fmtNum(input.total, Number.isInteger(input.total) ? 0 : 2)}</strong></div>
          </div>)}
          {displayScale !== 1 && <span className="operations-metric-evidence__scale">× {fmtNum(displayScale)}</span>}
        </div>
        <p className="operations-metric-evidence__rounding">{tr("표시값은 반올림하며, 계산에는 원본 합계를 사용합니다.", "Displayed values are rounded; calculations use the original totals.")}</p>
        <DataTable rows={active.dependencies} columns={inputColumns} rowKey={row => row.key} ariaLabel={tr("선택 지표의 입력 근거", "Inputs behind the selected metric")} />
      </section>
    </div>
    <p className="operations-chart__caption">{tr("동일 사용자의 이동이나 인과관계를 뜻하지 않습니다.", "These aggregates do not identify user-level progression or causal effects.")}</p>
    <div className="operations-metric-evidence__actions"><a href="#ops-campaign">{tr("관측 검토 목록으로", "Inspect the observed review queue")} →</a><a href="#ops-budget-title">{tr("같은 예산의 현재안·조정안 비교", "Compare current and adjusted budgets")} →</a></div>
  </section>;
}

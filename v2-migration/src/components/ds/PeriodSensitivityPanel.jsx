"use client";
import { useEffect, useRef, useState } from "react";
import { downloadCsv } from "@/utils/download";
import { periodSensitivityCsv } from "@/lib/analysis-results/periodSensitivity";

export default function PeriodSensitivityPanel({ compute, locale = "ko" }) {
  const en = locale === "en";
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const run = () => {
    const token = ++generation.current;
    setBusy(true); setFailed(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== generation.current) return;
      try { setResult(compute()); } catch { setResult(null); setFailed(true); }
      setBusy(false);
    }));
  };
  const labels = en
    ? { stable: "Same direction", changed: "Direction changed", unavailable: "Not comparable", saturated: "Saturated", scale: "Headroom", linear: "Steady", increase: "Increase", decrease: "Decrease", hold: "Hold" }
    : { stable: "방향 유지", changed: "방향 변경", unavailable: "비교 불가", saturated: "포화", scale: "여유", linear: "적정", increase: "증액", decrease: "감액", hold: "유지" };
  const value = (number) => Number.isFinite(number) ? number.toLocaleString(en ? "en-US" : "ko-KR", { maximumFractionDigits: 2 }) : "—";
  return <section className="analysis-design-check" aria-label={en ? "Period sensitivity" : "기간 민감도"}>
    <h3>{en ? "Does the direction survive a period change?" : "기간을 바꿔도 방향이 유지되나요?"}</h3>
    <p>{en ? "Split the selected dates into two non-overlapping halves and rerun the same method; allocation uses the same total budget in both. Each half needs at least four usable observations per entity. Sparse samples, missing channels, non-overlapping spend ranges, or infeasible budget constraints are not comparable. Matching directions do not establish causality or future stability. Spend ranges use the declared source currency." : "선택된 날짜를 겹치지 않는 전·후반으로 나눠 같은 방법을 다시 실행하며, 배분은 양쪽에 같은 총예산을 적용합니다. 각 기간·대상별 유효 관측이 최소 4개 필요합니다. 표본 부족·채널 누락·지출 범위 불일치·예산 제약 실패는 비교 불가입니다. 방향이 같아도 인과효과나 미래 안정성을 증명하지 않습니다. 지출 범위는 선언한 원본 통화 기준입니다."}</p>
    <button type="button" className="btn secondary" disabled={busy} onClick={run}>{busy ? (en ? "Checking…" : "확인 중…") : (en ? "Check period sensitivity" : "기간 민감도 확인")}</button>
    <div role="status" aria-live="polite">
      {failed && <p>{en ? "Unable to compute; no conclusion was produced." : "계산할 수 없어 결론을 내리지 않았습니다."}</p>}
      {result && <>
        <p>{result.periods.map((period) => `${period.start} ~ ${period.end}`).join(" / ")}</p>
        {!result.rows.length && <p>{en ? "No comparable dated observations." : "비교할 날짜 관측이 없습니다."}</p>}
        <ul>{result.rows.map((row) => <li key={row.name}>
          <strong>{row.name}: {labels[row.status]}</strong> · {labels[row.before.direction] || "—"} → {labels[row.after.direction] || "—"}
          <p>{en ? "Observed daily spend / retained observations" : "관측 일지출 / 사용 관측 수"}: {value(row.before.min)}–{value(row.before.max)} (n={row.before.n ?? 0}) → {value(row.after.min)}–{value(row.after.max)} (n={row.after.n ?? 0})</p>
        </li>)}</ul>
        <button type="button" className="btn secondary" onClick={() => downloadCsv(periodSensitivityCsv(result), "period_sensitivity")}>{en ? "Download period evidence CSV" : "기간 근거 CSV 받기"}</button>
      </>}
    </div>
  </section>;
}

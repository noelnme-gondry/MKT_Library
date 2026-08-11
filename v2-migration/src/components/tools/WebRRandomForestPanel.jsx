"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { prepareRandomForestInput, runWebRRandomForest } from "@/lib/analysis/webr/randomForest";

const COPY = {
  ko: {
    title: "WebR 고급 분석 · Random Forest 챌린저",
    desc: "같은 행을 결정론적 3~5겹 교차검증으로 나눠 Random Forest와 회귀 기준선을 맞대결합니다. 예측력이 좋아져도 변수 중요도는 인과효과가 아니며, 회귀의 계수·불확실성 표를 대체하지 않습니다.",
    run: "Random Forest 비교 실행",
    loading: "R Random Forest 500그루와 교차검증을 실행 중입니다…",
    blocked: (n, required) => `현재 ${n || 0}행입니다. 변수 수를 고려하면 최소 ${required || 100}행이 필요해 비교를 보류합니다.`,
    failed: "Random Forest 비교를 완료하지 못했습니다. 기존 회귀 결과에는 영향이 없습니다.",
    candidate: "예측 레이어 교체 후보",
    keep: "기존 회귀 예측 유지",
    tie: "실질적인 예측력 차이 없음",
    candidateBody: (gain) => `동일 교차검증에서 Random Forest의 주 지표 오차가 ${gain}% 낮았습니다. 예측 용도로만 교체 후보이며 해석·인과 판정은 기존 회귀를 유지해야 합니다.`,
    keepBody: "동일 교차검증에서 Random Forest가 회귀 기준선을 이기지 못했습니다. 현재 회귀를 유지합니다.",
    tieBody: "주 지표 차이가 5% 미만이라 엔진을 바꿀 근거가 부족합니다.",
    importance: "예측 중요도 상위 요소",
    caveat: "Permutation importance는 다른 변수를 함께 둔 예측 기여도입니다. 방향(+/−)과 인과효과를 뜻하지 않습니다.",
  },
  en: {
    title: "WebR advanced analysis · Random Forest challenger",
    desc: "Deterministic 3–5-fold cross-validation compares a Random Forest with the regression baseline on the same rows. Better prediction does not make feature importance causal, and it does not replace coefficient uncertainty.",
    run: "Run Random Forest comparison",
    loading: "Running a 500-tree R Random Forest and cross-validation…",
    blocked: (n, required) => `${n || 0} rows are available. This feature count requires at least ${required || 100}, so the comparison is withheld.`,
    failed: "The Random Forest comparison did not complete. The existing regression result is unchanged.",
    candidate: "Prediction-layer replacement candidate",
    keep: "Keep the current regression prediction",
    tie: "No material predictive difference",
    candidateBody: (gain) => `Random Forest reduced the primary error by ${gain}% in the same cross-validation. It is a prediction-only replacement candidate; keep regression for interpretation and causal caution.`,
    keepBody: "Random Forest did not beat the regression baseline in the same cross-validation. Keep the current regression.",
    tieBody: "The primary-metric difference is below 5%, so there is not enough evidence to switch engines.",
    importance: "Top predictive importance",
    caveat: "Permutation importance is predictive contribution with other variables present. It does not provide direction or a causal effect.",
  },
};

function metricValue(metric, value) {
  if (!Number.isFinite(value)) return "—";
  if (metric === "accuracy" || metric === "oos_r2") return value.toFixed(3);
  return value.toFixed(4);
}

export default function WebRRandomForestPanel({ fit, signature, locale = "ko", source = "csv" }) {
  const T = COPY[locale] || COPY.ko;
  const requestRef = useRef(0);
  const [run, setRun] = useState({ status: "idle", signature: null, result: null });
  const input = useMemo(() => prepareRandomForestInput({ X: fit?.X, y: fit?.y, terms: fit?.terms }), [fit]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  if (!fit?.X || !fit?.y) return null;

  const execute = async () => {
    if (!input.ok) return;
    const requestId = ++requestRef.current;
    setRun({ status: "loading", signature, result: null });
    trackProductEvent("analysis_started", {
      tool_id: "9-1", source, row_count: input.n, analysis_type: "webr_random_forest", locale,
    });
    try {
      const result = await runWebRRandomForest(input);
      if (requestId !== requestRef.current) return;
      setRun({ status: "complete", signature, result });
      trackProductEvent("analysis_completed", {
        tool_id: "9-1", source, row_count: input.n, analysis_type: "webr_random_forest", result_state: result.status, locale,
      });
    } catch {
      if (requestId !== requestRef.current) return;
      setRun({ status: "failed", signature, result: null });
      trackProductEvent("analysis_completed", {
        tool_id: "9-1", source, row_count: input.n, analysis_type: "webr_random_forest", result_state: "failed", locale,
      });
    }
  };

  const visible = run.signature === signature ? run : { status: "idle", result: null };
  const result = visible.result;
  const recommendation = result?.recommendation;
  const gain = Number.isFinite(result?.relativeGain) ? (result.relativeGain * 100).toFixed(1) : "—";
  const verdict = recommendation === "random_forest_candidate"
    ? { title: T.candidate, body: T.candidateBody(gain), tone: "info" }
    : recommendation === "baseline_regression"
      ? { title: T.keep, body: T.keepBody, tone: "warn" }
      : { title: T.tie, body: T.tieBody, tone: "info" };

  return (
    <section className="block" id="s-content-webr-random-forest">
      <h2 className="section-title"><span className="ix">ADV</span>{T.title}</h2>
      <p className="muted" style={{ fontSize: "12px", margin: "0 0 12px" }}>{T.desc}</p>
      {!input.ok ? (
        <div className="required-banner"><p style={{ margin: 0 }}>{T.blocked(input.n, input.requiredObservations)}</p></div>
      ) : (
        <>
          <button className="ab-button" onClick={execute} disabled={visible.status === "loading"}>
            {visible.status === "loading" ? T.loading : T.run}
          </button>
          {visible.status === "failed" && <div className="required-banner" style={{ marginTop: "12px" }}><p style={{ margin: 0 }}>{T.failed}</p></div>}
          {result?.status === "complete" && (
            <div style={{ marginTop: "14px" }}>
              <div className={`callout ${verdict.tone}`}>
                <div className="body"><strong>{verdict.title}</strong><p>{verdict.body}</p></div>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "10px 0" }}>
                <div className="stat-card"><div className="lbl">Random Forest · {result.primaryMetric}</div><div className="val">{metricValue(result.primaryMetric, result.randomForest.primary)}</div></div>
                <div className="stat-card"><div className="lbl">{result.baseline.engine} · {result.primaryMetric}</div><div className="val">{metricValue(result.primaryMetric, result.baseline.primary)}</div></div>
                <div className="stat-card"><div className="lbl">Random Forest · {result.secondaryMetric}</div><div className="val">{metricValue(result.secondaryMetric, result.randomForest.secondary)}</div></div>
                <div className="stat-card"><div className="lbl">{result.baseline.engine} · {result.secondaryMetric}</div><div className="val">{metricValue(result.secondaryMetric, result.baseline.secondary)}</div></div>
              </div>
              <h3 className="section-title" style={{ fontSize: "13px" }}>{T.importance}</h3>
              <div className="table-wrap"><table className="data" style={{ fontSize: "12px" }}>
                <thead><tr><th style={{ textAlign: "left" }}>{locale === "en" ? "Element" : "요소"}</th><th style={{ textAlign: "right" }}>importance</th></tr></thead>
                <tbody>{result.importance.slice(0, 10).map((row) => <tr key={row.name}><td>{row.name}</td><td className="tnum" style={{ textAlign: "right" }}>{row.importance.toFixed(4)}</td></tr>)}</tbody>
              </table></div>
              <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{T.caveat}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { prepareRandomForestInput, runWebRRandomForest } from "@/lib/analysis/webr/randomForest";

const COPY = {
  ko: {
    title: "Random Forest 자동 비교",
    desc: "분석을 시작하면 같은 행의 결정론적 3~5겹 교차검증으로 Random Forest와 회귀 기준선을 자동 비교합니다. 오차가 낮은 모델을 기본 선택하고, 두 결과 중 보고 싶은 모델을 직접 고를 수 있습니다.",
    run: "Random Forest 다시 실행",
    loading: "R Random Forest 500그루와 교차검증을 실행 중입니다…",
    blocked: (n, required) => `현재 ${n || 0}행입니다. 변수 수를 고려하면 최소 ${required || 100}행이 필요해 비교를 보류합니다.`,
    failed: "Random Forest 비교를 완료하지 못했습니다. 기존 회귀 결과에는 영향이 없습니다.",
    candidate: "예측 정확도 승자: Random Forest",
    keep: "예측 정확도 승자: 기존 회귀",
    tie: "예측 승자 보류: 실질적인 예측력 차이 없음",
    candidateBody: (gain) => `동일 교차검증에서 Random Forest의 주 지표 오차가 ${gain}% 낮았습니다. 예측 용도로만 교체 후보이며 해석·인과 판정은 기존 회귀를 유지해야 합니다.`,
    keepBody: (gain) => `동일 교차검증에서 기존 회귀의 주 지표 오차가 Random Forest보다 ${gain}% 낮았습니다. 기존 회귀를 기본 선택했습니다.`,
    tieBody: (difference) => `관측된 주 지표 차이는 ${difference}입니다. 사전 운영 임계값 5% 미만이라 자동 승자를 정하지 않습니다.`,
    importance: "예측 중요도 상위 요소",
    caveat: "Permutation importance는 다른 변수를 함께 둔 예측 기여도입니다. 방향(+/−)과 인과효과를 뜻하지 않습니다.",
    selected: "선택됨",
    calculating: "자동 계산 중",
    lowerIsBetter: "낮을수록 정확",
    baselineDetail: "회귀 결과의 계수·신뢰구간은 위 기본 분석에서 확인할 수 있습니다.",
    logistic: "로지스틱 회귀",
    ols: "선형 회귀",
  },
  en: {
    title: "Automatic Random Forest comparison",
    desc: "Starting the analysis automatically compares a Random Forest with the regression baseline using deterministic 3–5-fold cross-validation on the same rows. The lower-error model is selected by default, and you can choose either result.",
    run: "Retry Random Forest",
    loading: "Running a 500-tree R Random Forest and cross-validation…",
    blocked: (n, required) => `${n || 0} rows are available. This feature count requires at least ${required || 100}, so the comparison is withheld.`,
    failed: "The Random Forest comparison did not complete. The existing regression result is unchanged.",
    candidate: "Predictive-accuracy winner: Random Forest",
    keep: "Predictive-accuracy winner: current regression",
    tie: "Predictive winner withheld: no material difference",
    candidateBody: (gain) => `Random Forest reduced the primary error by ${gain}% in the same cross-validation. It is a prediction-only replacement candidate; keep regression for interpretation and causal caution.`,
    keepBody: (gain) => `The current regression reduced primary-metric error by ${gain}% versus Random Forest in the same cross-validation, so it is selected by default.`,
    tieBody: (difference) => `The observed primary-metric difference is ${difference}. It is below the predeclared 5% operating threshold, so no automatic winner is selected.`,
    importance: "Top predictive importance",
    caveat: "Permutation importance is predictive contribution with other variables present. It does not provide direction or a causal effect.",
    selected: "Selected",
    calculating: "Calculating automatically",
    lowerIsBetter: "lower is better",
    baselineDetail: "The regression coefficients and confidence intervals remain available in the primary analysis above.",
    logistic: "Logistic regression",
    ols: "Linear regression",
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
  const autoSignatureRef = useRef(null);
  const [run, setRun] = useState({ status: "idle", signature: null, result: null });
  const [selectedModel, setSelectedModel] = useState("baseline");
  const input = useMemo(() => prepareRandomForestInput({ X: fit?.X, y: fit?.y, terms: fit?.terms }), [fit]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const execute = useCallback(async () => {
    if (!input.ok) return;
    const requestId = ++requestRef.current;
    setRun({ status: "loading", signature, result: null });
    setSelectedModel("baseline");
    trackProductEvent("analysis_started", {
      tool_id: "9-1", source, row_count: input.n, analysis_type: "webr_random_forest", locale,
    });
    try {
      const result = await runWebRRandomForest(input);
      if (requestId !== requestRef.current) return;
      setRun({ status: "complete", signature, result });
      setSelectedModel(result.recommendation === "random_forest_candidate" ? "random_forest" : "baseline");
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
  }, [input, locale, signature, source]);

  useEffect(() => {
    if (!signature || !input.ok || autoSignatureRef.current === signature) return;
    autoSignatureRef.current = signature;
    execute();
  }, [execute, input.ok, signature]);

  if (!fit?.X || !fit?.y) return null;

  const visible = run.signature === signature ? run : { status: "idle", result: null };
  const result = visible.result;
  const recommendation = result?.recommendation;
  const baselineLabel = result?.outcomeType === "classification" ? T.logistic : T.ols;
  const gain = Number.isFinite(result?.relativeGain) ? (result.relativeGain * 100).toFixed(1) : "—";
  const observedDifference = Number.isFinite(result?.relativeGain)
    ? result.relativeGain > 0
      ? `Random Forest ${Math.abs(result.relativeGain * 100).toFixed(1)}% ${locale === "en" ? "lower" : "낮음"}`
      : `${baselineLabel} ${Math.abs(result.relativeGain * 100).toFixed(1)}% ${locale === "en" ? "lower" : "낮음"}`
    : "—";
  const verdict = recommendation === "random_forest_candidate"
    ? { title: T.candidate, body: T.candidateBody(gain), tone: "info" }
    : recommendation === "baseline_regression"
      ? { title: T.keep, body: T.keepBody(Math.abs(result.relativeGain * 100).toFixed(1)), tone: "warn" }
      : { title: T.tie, body: T.tieBody(observedDifference), tone: "info" };
  const onModelKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const choices = Array.from(event.currentTarget.parentElement?.querySelectorAll('[role="radio"]') || []);
    if (!choices.length) return;
    event.preventDefault();
    const current = Math.max(0, choices.indexOf(event.currentTarget));
    const nextIndex = event.key === "Home" ? 0 : event.key === "End"
      ? choices.length - 1
      : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + choices.length) % choices.length;
    choices[nextIndex].focus();
    choices[nextIndex].click();
  };

  return (
    <section className="block" id="s-content-webr-random-forest">
      <h2 className="section-title"><span className="ix">ADV</span>{T.title}</h2>
      <p className="muted" style={{ fontSize: "12px", margin: "0 0 12px" }}>{T.desc}</p>
      {!input.ok ? (
        <div className="required-banner"><p style={{ margin: 0 }}>{T.blocked(input.n, input.requiredObservations)}</p></div>
      ) : (
        <>
          {(visible.status === "loading" || visible.status === "idle") && <p className="muted" style={{ fontSize: "12px" }}>{T.loading}</p>}
          {visible.status === "failed" && <div className="required-banner" style={{ marginTop: "12px" }}><p style={{ margin: 0 }}>{T.failed}</p><button className="ab-button" style={{ marginTop: "8px" }} onClick={execute}>{T.run}</button></div>}
          {result?.status === "complete" && (
            <div style={{ marginTop: "14px" }}>
              <div className={`callout ${verdict.tone}`}>
                <div className="body"><strong>{verdict.title}</strong><p>{verdict.body}</p></div>
              </div>
              <div className="mmm-model-switcher" role="radiogroup" aria-label={T.title}>
                <button type="button" role="radio" aria-checked={selectedModel === "baseline"} className={`mmm-model-choice ${selectedModel === "baseline" ? "is-selected" : ""}`} onClick={() => setSelectedModel("baseline")} onKeyDown={onModelKeyDown}>
                  <span className="mmm-model-choice__radio" aria-hidden="true" />
                  <span className="mmm-model-choice__copy"><strong>{baselineLabel}</strong><small>{result.primaryMetric} · {T.lowerIsBetter}<br />{result.secondaryMetric} {metricValue(result.secondaryMetric, result.baseline.secondary)}</small></span>
                  <span className="mmm-model-choice__metric">{metricValue(result.primaryMetric, result.baseline.primary)}</span>
                  <span className="mmm-model-choice__badges">{selectedModel === "baseline" && <b>{T.selected}</b>}</span>
                </button>
                <button type="button" role="radio" aria-checked={selectedModel === "random_forest"} className={`mmm-model-choice ${selectedModel === "random_forest" ? "is-selected" : ""}`} onClick={() => setSelectedModel("random_forest")} onKeyDown={onModelKeyDown}>
                  <span className="mmm-model-choice__radio" aria-hidden="true" />
                  <span className="mmm-model-choice__copy"><strong>Random Forest</strong><small>{result.primaryMetric} · {T.lowerIsBetter}<br />{result.secondaryMetric} {metricValue(result.secondaryMetric, result.randomForest.secondary)}</small></span>
                  <span className="mmm-model-choice__metric">{metricValue(result.primaryMetric, result.randomForest.primary)}</span>
                  <span className="mmm-model-choice__badges">{selectedModel === "random_forest" && <b>{T.selected}</b>}</span>
                </button>
              </div>
              {selectedModel === "random_forest" ? <>
                <h3 className="section-title" style={{ fontSize: "13px" }}>{T.importance}</h3>
                <div className="table-wrap"><table className="data" style={{ fontSize: "12px" }}>
                  <thead><tr><th style={{ textAlign: "left" }}>{locale === "en" ? "Element" : "요소"}</th><th style={{ textAlign: "right" }}>importance</th></tr></thead>
                  <tbody>{result.importance.slice(0, 10).map((row) => <tr key={row.name}><td>{row.name}</td><td className="tnum" style={{ textAlign: "right" }}>{row.importance.toFixed(4)}</td></tr>)}</tbody>
                </table></div>
                <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{T.caveat}</p>
              </> : <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{T.baselineDetail}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

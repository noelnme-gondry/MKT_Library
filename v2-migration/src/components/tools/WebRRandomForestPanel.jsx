"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { prepareRandomForestInput, runWebRRandomForest } from "@/lib/analysis/webr/randomForest";

const COPY = {
  ko: {
    title: "Random Forest 자동 비교",
    desc: "기본 회귀 결과를 먼저 읽은 뒤, 예측력이 실제로 더 나아지는지만 추가로 비교합니다.",
    run: "Random Forest 다시 실행",
    loading: "Random Forest 500그루와 교차검증을 실행 중입니다. 첫 실행은 R 엔진을 불러와 10~20초 걸릴 수 있습니다.",
    blocked: (n, required) => `현재 완전한 행은 ${n || 0}개입니다. 선택한 요소 수 기준으로 최소 ${required || 100}개가 필요합니다.`,
    tooManyObservations: (max) => `완전한 행이 브라우저 R 엔진의 안전 한도(${max}개)를 넘었습니다. 기간·세그먼트·요소를 좁혀 다시 실행하세요.`,
    tooManyPredictors: (max) => `선택한 요소가 브라우저 R 엔진의 안전 한도(${max}개)를 넘었습니다. 요소를 줄여 다시 실행하세요.`,
    failed: "Random Forest 비교를 완료하지 못했습니다. 기존 회귀 결과에는 영향이 없습니다.", baselineUnavailable: "기준 회귀가 일부 교차검증 분할에서 수렴하지 않아 비교를 보류했습니다. Random Forest 우위로 해석하지 않습니다.",
    whyBlocked: "왜 Random Forest 분석이 안 되나요?",
    requirements: "필요 데이터 기준",
    requirementsBody: (required) => `콘텐츠 1건당 1행, 숫자 성과 1개, 숫자 요소 1개 이상, 빈칸 없는 행 최소 ${required || 100}개가 필요합니다. 0/1 성과라면 0과 1이 각각 20행 이상이어야 합니다.`,
    invalid: "선택한 성과·요소에 숫자가 아닌 값이나 빈칸이 많아 비교 입력을 만들지 못했습니다.",
    constant: "선택한 성과 값이 모두 같아 예측 모델을 비교할 수 없습니다.",
    classSupport: (minority, required) => `0/1 성과 중 적은 쪽이 ${minority || 0}행입니다. 각 값이 최소 ${required || 20}행 필요합니다.`,
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
    desc: "Read the baseline regression first, then use this optional comparison only to check whether predictive accuracy materially improves.",
    run: "Retry Random Forest",
    loading: "Running a 500-tree Random Forest and cross-validation. The first run can take 10–20 seconds while the R engine loads.",
    blocked: (n, required) => `${n || 0} complete rows are available. The selected feature count requires at least ${required || 100}.`,
    tooManyObservations: (max) => `Complete rows exceed the browser R safety limit (${max}). Narrow the period, segment, or features and try again.`,
    tooManyPredictors: (max) => `Selected features exceed the browser R safety limit (${max}). Reduce the features and try again.`,
    failed: "The Random Forest comparison did not complete. The existing regression result is unchanged.", baselineUnavailable: "The baseline regression did not converge in at least one validation fold, so the comparison is withheld. This is not evidence that Random Forest is better.",
    whyBlocked: "Why isn't Random Forest available?",
    requirements: "Data requirements",
    requirementsBody: (required) => `Use one row per content item, one numeric outcome, at least one numeric feature, and at least ${required || 100} complete rows. For a binary outcome, both 0 and 1 need at least 20 rows.`,
    invalid: "The selected outcome or features contain too many non-numeric or missing values to build the comparison input.",
    constant: "The selected outcome is constant, so predictive models cannot be compared.",
    classSupport: (minority, required) => `The smaller binary class has ${minority || 0} rows; each class needs at least ${required || 20}.`,
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
  const [run, setRun] = useState({ status: "idle", signature: null, result: null, error: null });
  const [selectedModel, setSelectedModel] = useState("baseline");
  const input = useMemo(() => prepareRandomForestInput({ X: fit?.X, y: fit?.y, terms: fit?.terms }), [fit]);
  const predictorCount = input.predictorCount ?? Math.max(0, (fit?.terms?.length || 1) - 1);
  const observedRows = input.n ?? fit?.y?.length ?? 0;
  const requiredObservations = input.requiredObservations ?? Math.max(100, predictorCount * 20);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const execute = useCallback(async () => {
    if (!input.ok) return;
    const requestId = ++requestRef.current;
    setRun({ status: "loading", signature, result: null, error: null });
    setSelectedModel("baseline");
    trackProductEvent("analysis_started", {
      tool_id: "9-1", source, row_count: input.n, analysis_type: "webr_random_forest", locale,
    });
    try {
      const result = await runWebRRandomForest(input);
      if (requestId !== requestRef.current) return;
      setRun({ status: "complete", signature, result, error: null });
      setSelectedModel(result.recommendation === "random_forest_candidate" ? "random_forest" : "baseline");
      trackProductEvent("analysis_completed", {
        tool_id: "9-1", source, row_count: input.n, analysis_type: "webr_random_forest", result_state: result.status, locale,
      });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setRun({ status: "failed", signature, result: null, error: String(error?.message || "") });
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

  if (!input.ok) {
    const reason = input.reason === "constant_outcome"
      ? T.constant
      : input.reason === "too_many_observations"
        ? T.tooManyObservations(input.maxObservations)
        : input.reason === "too_many_predictors"
          ? T.tooManyPredictors(input.maxPredictors)
      : input.reason === "insufficient_class_support"
        ? T.classSupport(input.minorityCount, input.requiredMinority)
        : input.reason === "insufficient_observations"
          ? T.blocked(observedRows, requiredObservations)
          : T.invalid;
    return (
      <details className="rf-help" id="s-content-webr-random-forest">
        <summary><span aria-hidden="true">ⓘ</span> {T.whyBlocked}</summary>
        <div className="rf-help__body">
          <strong>{reason}</strong>
          <p>{T.requirementsBody(requiredObservations)}</p>
        </div>
      </details>
    );
  }

  const visible = run.signature === signature ? run : { status: "idle", result: null, error: null };
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
      <details className="rf-requirements">
        <summary><span aria-hidden="true">ⓘ</span> {T.requirements}</summary>
        <p>{T.requirementsBody(requiredObservations)}</p>
      </details>
      <>
          {(visible.status === "loading" || visible.status === "idle") && <p className="muted" style={{ fontSize: "12px" }}>{T.loading}</p>}
          {visible.status === "failed" && <div className="required-banner" style={{ marginTop: "12px" }}><p style={{ margin: 0 }}>{visible.error.includes("baseline_regression_not_estimable") ? T.baselineUnavailable : T.failed}</p><button className="ab-button" style={{ marginTop: "8px" }} onClick={execute}>{T.run}</button></div>}
          {result?.status === "complete" && (
            <div style={{ marginTop: "14px" }}>
              <div className={`callout ${verdict.tone}`}>
                <div className="body"><strong>{verdict.title}</strong><p>{verdict.body}</p></div>
              </div>
              <div className="mmm-model-switcher" role="radiogroup" aria-label={T.title}>
                <button type="button" role="radio" aria-checked={selectedModel === "baseline"} className={`mmm-model-choice ${selectedModel === "baseline" ? "is-selected" : ""}`} onClick={() => setSelectedModel("baseline")} onKeyDown={onModelKeyDown}>
                  <span className="mmm-model-choice__radio" aria-hidden="true" />
                  <span className="mmm-model-choice__copy"><strong>{baselineLabel}</strong><small>{result.primaryMetric} · {T.lowerIsBetter} · {result.secondaryMetric} {metricValue(result.secondaryMetric, result.baseline.secondary)}</small></span>
                  <span className="mmm-model-choice__metric">{metricValue(result.primaryMetric, result.baseline.primary)}</span>
                  <span className="mmm-model-choice__badges">{selectedModel === "baseline" && <b>{T.selected}</b>}</span>
                </button>
                <button type="button" role="radio" aria-checked={selectedModel === "random_forest"} className={`mmm-model-choice ${selectedModel === "random_forest" ? "is-selected" : ""}`} onClick={() => setSelectedModel("random_forest")} onKeyDown={onModelKeyDown}>
                  <span className="mmm-model-choice__radio" aria-hidden="true" />
                  <span className="mmm-model-choice__copy"><strong>Random Forest</strong><small>{result.primaryMetric} · {T.lowerIsBetter} · {result.secondaryMetric} {metricValue(result.secondaryMetric, result.randomForest.secondary)}</small></span>
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
    </section>
  );
}

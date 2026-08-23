"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { trackProductEvent } from "@/lib/analytics";
import { prepareRandomForestInput, runWebRRandomForest } from "@/lib/analysis/webr/randomForest";
import { prepareSvmInput, runWebRSvm } from "@/lib/analysis/webr/svm";
import { buildCreativePredictiveInput, creativeShapleyR2 } from "@/utils/creativePredictiveModel";

const NUMERIC_FEATURES = Object.freeze(["duration_seconds", "text_length", "scene_cut_count", "face_screen_ratio", "speech_rate"]);

const COPY = {
  ko: {
    title: "예측 모델 비교와 설명력 분해",
    deck: "기존 WLS는 속성 해석 기준으로 유지합니다. 독립 소재와 제작 특성이 충분할 때만 RF·SVM을 같은 교차검증으로 비교합니다.",
    sample: "독립 소재", predictors: "인코딩 변수", numeric: "연속형 제작 특성", ready: "실행 가능", blocked: "데이터 기준 미달",
    rfNeed: (required) => `RF는 현재 변수 수 기준 독립 소재 ${required || 100}개 이상이 필요합니다.`,
    svmNeed: (required) => `SVM은 독립 소재 ${required || 120}개 이상과 성과 결과가 아닌 연속형 제작 특성 2개 이상이 필요합니다.`,
    running: "같은 5-fold 조건에서 기준 회귀·Random Forest·SVM을 비교하고 있습니다. 첫 실행은 브라우저 R 엔진을 받아 시간이 걸릴 수 있습니다.",
    failed: "예측 모델 비교를 완료하지 못했습니다. 기존 WLS 결과와 Shapley R² 분해에는 영향이 없습니다.", baselineUnavailable: "기준 회귀가 일부 교차검증 분할에서 수렴하지 않아 비교를 보류했습니다. RF·SVM 우위로 해석하지 않습니다.", retry: "예측 모델 다시 실행",
    comparison: "동일 검증 성능", baseline: "기준 회귀", lower: "오차(낮을수록 좋음)", gain: "기준 대비 오차 개선", noWinner: "승자 보류", winner: "예측 후보", keep: "기준 유지",
    importance: "RF 예측 중요도", importanceCaveat: "순열 중요도는 예측에 기여한 정도이며 방향이나 인과효과가 아닙니다.",
    shapley: "속성별 설명력 배분 (Shapley R²)", shapleyDeck: "채널 차이를 먼저 통제한 뒤, 속성을 넣는 모든 순서를 평균해 추가 R²를 배분합니다.",
    shapleyCaveat: "이 값은 관측 데이터의 전역 설명력 배분입니다. 개별 소재 SHAP 값이나 인과 기여도가 아닙니다.", shapleyUnavailable: "현재 속성 조합은 일부 회귀가 식별되지 않아 Shapley R²를 표시하지 않습니다.",
  },
  en: {
    title: "Predictive model comparison and explanatory decomposition",
    deck: "WLS remains the interpretation baseline. RF and SVM are compared on the same cross-validation only when independent creatives and production features are sufficient.",
    sample: "Independent creatives", predictors: "Encoded predictors", numeric: "Continuous production features", ready: "Eligible", blocked: "Below data threshold",
    rfNeed: (required) => `RF needs at least ${required || 100} independent creatives for the current feature count.`,
    svmNeed: (required) => `SVM needs at least ${required || 120} independent creatives and two continuous production features that are not outcome components.`,
    running: "Comparing baseline regression, Random Forest, and SVM under the same five-fold validation. The first browser R runtime load can take a while.",
    failed: "The predictive comparison did not complete. Existing WLS results and Shapley R² are unchanged.", baselineUnavailable: "The baseline regression did not converge in at least one validation fold, so the comparison is withheld. This is not evidence that RF or SVM is better.", retry: "Retry predictive models",
    comparison: "Same-fold performance", baseline: "Baseline regression", lower: "error (lower is better)", gain: "error gain vs baseline", noWinner: "Winner withheld", winner: "Prediction candidate", keep: "Keep baseline",
    importance: "RF predictive importance", importanceCaveat: "Permutation importance reflects predictive contribution, not direction or causal effect.",
    shapley: "Attribute explanatory allocation (Shapley R²)", shapleyDeck: "After controlling for channel, incremental R² is averaged across every attribute-entry order.",
    shapleyCaveat: "This is a global allocation of observed explanatory power, not per-creative SHAP or causal contribution.", shapleyUnavailable: "Some attribute subsets are not identified, so Shapley R² is withheld.",
  },
};

function fmt(value, digits = 4) { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }

function groupedImportance(result) {
  const grouped = new Map();
  for (const row of result?.importance || []) {
    const group = String(row.name || "").split("=")[0] || row.name;
    grouped.set(group, (grouped.get(group) || 0) + Math.abs(Number(row.importance) || 0));
  }
  return [...grouped.entries()].map(([attribute, importance]) => ({ attribute, importance })).sort((left, right) => right.importance - left.importance);
}

function EligibilityCard({ label, input, body, C }) {
  return <article className={`creative-model-router__eligibility ${input.ok ? "is-ready" : "is-blocked"}`}><span>{input.ok ? C.ready : C.blocked}</span><strong>{label}</strong><p>{body}</p></article>;
}

export default function CreativePredictiveModelPanel({ metrics = [], attributes = [], metric = "ctr", mappedKeys = new Set(), signature, locale = "ko", source = "csv" }) {
  const C = COPY[locale] || COPY.ko;
  const requestRef = useRef(0);
  const autoSignatureRef = useRef("");
  const numericFeatures = useMemo(() => NUMERIC_FEATURES.filter((feature) => mappedKeys.has(feature)), [mappedKeys]);
  const design = useMemo(() => buildCreativePredictiveInput({ metrics, attributes, numericFeatures, metric }), [attributes, metric, metrics, numericFeatures]);
  const rfInput = useMemo(() => design.ok ? prepareRandomForestInput(design) : { ok: false, reason: design.reason, n: design.n || 0 }, [design]);
  const svmInput = useMemo(() => design.ok ? prepareSvmInput({ ...design, numericFeatureCount: design.numericFeatureCount }) : { ok: false, reason: design.reason, n: design.n || 0 }, [design]);
  const shapley = useMemo(() => creativeShapleyR2({ metrics, attributes, metric }), [attributes, metric, metrics]);
  const runSignature = `${signature || ""}:${metric}:${design.predictorCount || 0}:${design.numericFeatureCount || 0}`;
  const [run, setRun] = useState({ signature: "", status: "idle", randomForest: null, svm: null, error: null });
  const canRun = rfInput.ok || svmInput.ok;

  useEffect(() => () => { requestRef.current += 1; }, []);
  const execute = useCallback(async () => {
    if (!canRun) return;
    const requestId = ++requestRef.current;
    setRun({ signature: runSignature, status: "loading", randomForest: null, svm: null, error: null });
    trackProductEvent("analysis_started", { tool_id: "9-6", source, row_count: design.n, analysis_type: "creative_predictive_router", locale });
    try {
      const [randomForest, svm] = await Promise.all([rfInput.ok ? runWebRRandomForest(rfInput) : Promise.resolve(null), svmInput.ok ? runWebRSvm(svmInput) : Promise.resolve(null)]);
      if (requestId !== requestRef.current) return;
      setRun({ signature: runSignature, status: "complete", randomForest, svm, error: null });
      trackProductEvent("analysis_completed", { tool_id: "9-6", source, row_count: design.n, analysis_type: "creative_predictive_router", result_state: "complete", locale });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setRun({ signature: runSignature, status: "failed", randomForest: null, svm: null, error: String(error?.message || "") });
      trackProductEvent("analysis_completed", { tool_id: "9-6", source, row_count: design.n, analysis_type: "creative_predictive_router", result_state: "failed", locale });
    }
  }, [canRun, design.n, locale, rfInput, runSignature, source, svmInput]);
  useEffect(() => {
    if (!canRun || !runSignature || autoSignatureRef.current === runSignature) return;
    autoSignatureRef.current = runSignature;
    execute();
  }, [canRun, execute, runSignature]);

  if (!design.ok && shapley.status === "not_computable") return null;
  const visible = run.signature === runSignature ? run : { status: "idle", randomForest: null, svm: null, error: null };
  const rf = visible.randomForest;
  const svm = visible.svm;
  const baseline = rf?.baseline || svm?.baseline || null;
  const candidates = [
    baseline && { id: "baseline", label: C.baseline, primary: Number(baseline.primary), gain: 0 },
    rf && { id: "rf", label: "Random Forest", primary: Number(rf.randomForest.primary), gain: rf.relativeGain },
    svm && { id: "svm", label: "SVM (RBF)", primary: Number(svm.svm.primary), gain: svm.relativeGain },
  ].filter(Boolean);
  const best = candidates.filter((candidate) => candidate.id !== "baseline" && candidate.gain >= 0.05).sort((left, right) => left.primary - right.primary)[0] || candidates.find((candidate) => candidate.id === "baseline");
  const importance = groupedImportance(rf);
  const importanceMax = Math.max(...importance.map((row) => row.importance), 0);
  const shapleyMax = Math.max(...(shapley.rows || []).map((row) => Math.abs(row.contribution)), 0);

  return <section className="block creative-model-router" id="s-creative-predictive-models">
    <h2 className="section-title"><span className="ix">ADV</span>{C.title}</h2><p className="muted creative-model-router__deck">{C.deck}</p>
    <dl className="creative-model-router__profile"><div><dt>{C.sample}</dt><dd>{design.n || 0}</dd></div><div><dt>{C.predictors}</dt><dd>{design.predictorCount || 0}</dd></div><div><dt>{C.numeric}</dt><dd>{design.numericFeatureCount || 0}</dd></div></dl>
    <div className="creative-model-router__eligibility-grid"><EligibilityCard label="Random Forest" input={rfInput} body={C.rfNeed(rfInput.requiredObservations)} C={C} /><EligibilityCard label="SVM (RBF)" input={svmInput} body={C.svmNeed(svmInput.requiredObservations)} C={C} /></div>
    {canRun && (visible.status === "idle" || visible.status === "loading") && <p className="creative-model-router__loading" role="status">{C.running}</p>}
    {visible.status === "failed" && <div className="required-banner"><p>{visible.error.includes("baseline_regression_not_estimable") ? C.baselineUnavailable : C.failed}</p><button type="button" className="ab-button" onClick={execute}>{C.retry}</button></div>}
    {candidates.length > 1 && <section className="creative-model-router__comparison" aria-labelledby="creative-model-comparison-title"><header><h3 id="creative-model-comparison-title">{C.comparison}</h3><span>{rf?.primaryMetric || svm?.primaryMetric} · {C.lower}</span></header><div>{candidates.map((candidate) => <article className={best?.id === candidate.id ? "is-selected" : ""} key={candidate.id}><span>{best?.id === candidate.id ? (candidate.id === "baseline" ? C.keep : C.winner) : C.noWinner}</span><strong>{candidate.label}</strong><b>{fmt(candidate.primary)}</b><small>{C.gain}: {candidate.id === "baseline" ? "—" : `${fmt(candidate.gain * 100, 1)}%`}</small></article>)}</div></section>}
    {importance.length > 0 && <section className="creative-model-router__explanation"><header><h3>{C.importance}</h3><p>{C.importanceCaveat}</p></header><ol>{importance.slice(0, 8).map((row) => <li key={row.attribute}><span>{row.attribute}</span><i style={{ "--creative-model-bar": `${importanceMax > 0 ? Math.max(2, row.importance / importanceMax * 100) : 0}%` }} /><b>{fmt(row.importance)}</b></li>)}</ol></section>}
    <section className="creative-model-router__explanation"><header><h3>{C.shapley}</h3><p>{C.shapleyDeck}</p></header>{shapley.status === "complete" ? <><ol>{shapley.rows.map((row) => <li key={row.attribute}><span>{row.attribute}</span><i style={{ "--creative-model-bar": `${shapleyMax > 0 ? Math.max(2, Math.abs(row.contribution) / shapleyMax * 100) : 0}%` }} /><b>{fmt(row.contribution)}</b></li>)}</ol><small>{C.shapleyCaveat} · n={shapley.n} · ΔR²={fmt(shapley.incrementalR2)}</small></> : <p className="muted">{C.shapleyUnavailable}</p>}</section>
  </section>;
}

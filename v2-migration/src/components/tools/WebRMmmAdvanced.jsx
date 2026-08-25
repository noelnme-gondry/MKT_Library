"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { prepareMmmElasticNetInput, runWebRMmmElasticNet } from "@/lib/analysis/webr/mmmElasticNet";
import {
  buildElasticNetResponseCurve,
  elasticNetMarginalAt,
  elasticNetResponseAt,
  evaluateElasticNetChannelGate,
  optimizeElasticNetBudget,
} from "@/lib/analysis/webr/mmmElasticNetResponse";
import Chart from "@/utils/chartGlobals";
import { chartCommonOpts, CHART_THEME } from "@/utils/chartUtils";
import { CommaNumberInput } from "@/components/tools/marketingResponseModel";
import ResultActionCard from "@/components/ds/ResultActionCard";

const COPY = {
  ko: {
    title: "MMM 결과 모델",
    desc: "Bayesian과 WebR을 같은 시간순 검증구간에서 자동 비교하고, 오차가 충분히 낮은 모델을 먼저 엽니다. 아래 선택으로 두 결과를 언제든 바꿔 볼 수 있습니다.",
    run: "WebR 다시 실행",
    loading: "R glmnet 후보와 시간순 검증을 계산 중입니다…",
    blocked: (n, required, reason) => reason === "insufficient_comparable_history" && n >= required
      ? `현재 ${n || 0}주이지만 두 모델에 공통으로 쓸 시간순 검증구간 2개를 만들지 못했습니다. 주차 연속성과 결측값을 확인하세요.`
      : `현재 ${n || 0}주입니다. 두 모델을 같은 2개 이상의 시간순 검증구간에서 비교하려면 최소 ${required || 120}주가 필요합니다.`,
    failed: "WebR MMM 비교를 완료하지 못했습니다. 현재 MMM 결과에는 영향이 없습니다.",
    candidate: "예측 정확도 승자: WebR Elastic-net",
    candidateBody: (gain) => `같은 복수 시간창에서 WebR의 WMAPE가 Bayesian보다 ${gain}% 낮았습니다. WebR 결과를 기본 선택했습니다.`,
    keep: "예측 정확도 승자: Bayesian MMM",
    keepBody: (gain) => `같은 시간순 검증에서 Bayesian MMM의 WMAPE가 WebR보다 ${gain}% 낮거나 같아 Bayesian 결과를 기본 선택했습니다.`,
    validate: "예측 승자 보류: 검증 근거 부족",
    validateBody: (difference) => `관측된 오차 차이는 ${difference}입니다. 두 모델은 모두 표시하지만 비교 가능한 시간창이 2개 미만이거나 상대 개선폭이 5% 미만이라 자동 승자를 정하지 않습니다.`,
    bayesian: "Bayesian MMM",
    webr: "WebR Elastic-net",
    selected: "선택됨",
    calculating: "자동 계산 중",
    unavailable: "비교 불가",
    lowerIsBetter: "WMAPE · 낮을수록 정확",
    bayesianDetail: "아래 채널 기여·반응곡선·예산 진단은 Bayesian MMM 결과입니다.",
    modelChoice: "결과 모델 선택",
    oosWmape: "시간순 OOS WMAPE",
    selectedBadge: "현재 결과",
    recommendedBadge: "예측 추천",
    fitStep: "실제 성과를 얼마나 설명했나",
    fitStepDesc: "실제값과 학습기간 적합값을 먼저 확인하고, 일반화 성능은 별도의 시간순 OOS WMAPE로 판단합니다.",
    actual: "실제",
    fitted: "WebR 적합값",
    inSampleR2: "학습기간 R²",
    inSampleWmape: "학습 WMAPE",
    oosFoldRange: "OOS fold 범위",
    rmse: "RMSE",
    fitCaveat: "R²와 학습 WMAPE는 과거 설명력이고, OOS WMAPE는 보지 않은 미래 구간의 예측 오차입니다. 어느 지표도 인과효과를 뜻하지 않습니다.",
    driverStep: "무엇이 성과를 설명했나",
    driverStepDesc: "채널·추세·계절성·이벤트가 매주 적합값에 더하거나 뺀 값을 그대로 보여줍니다. 기여는 예측 분해이며 인과 기여가 아닙니다.",
    weeklyContribution: "주별 예측 기여",
    driver: "드라이버",
    driverType: "구분",
    weeklyMean: "주 평균 기여",
    rmsShare: "RMS 크기 비중",
    baseline: "기본 수요",
    media: "광고 채널",
    control: "비광고",
    coefficientStep: "채널 효과는 검증에서도 유지됐나",
    coefficientStepDesc: "WebR은 채널마다 여러 carryover 후보를 함께 규제합니다. 아래 계수 범위는 검증 fold에서 다시 적합한 값의 범위이며 신뢰구간이나 posterior가 아닙니다.",
    coefficient: "합산 계수",
    nonzeroTerms: "선택된 carryover",
    coefficientFoldRange: "fold 계수 범위",
    allCoefficients: "추세·계절성·이벤트를 포함한 전체 계수",
    term: "모델 항",
    modelSetup: "모델 설정",
    responseStep: "지출을 바꾸면 예측이 어떻게 달라지나",
    budgetStep: "예산 변경을 추천해도 안전한가",
    foldLower: "검증 fold 하한",
    foldUpper: "검증 fold 상한",
    importance: "WebR 예측 중요도",
    caveat: "중요도는 |계수×표준편차|를 같은 채널의 adstock 후보끼리 합친 예측값입니다. 현재 MMM의 채널 기여율이나 인과효과가 아닙니다.",
    responseTitle: "채널별 예측 반응곡선",
    responseDesc: "최근 carryover를 고정하고 다음 주 지출만 바꾼 조건부 예측 증분입니다. 실험으로 식별한 인과효과가 아닙니다. 실선과 fold 범위는 관측한 주간 지출 범위 안에서만 그립니다.",
    spendAxis: "주간 지출",
    responseAxis: "예측 증분",
    current: "최근 12주 평균",
    marginal: "다음 증액 단위 한계효과",
    saturation: "현재 포화 수준",
    foldRange: "검증 fold 범위",
    gateTitle: "예산 추천 안전 게이트",
    gatePass: "통과",
    gateHold: "보류",
    budgetTitle: "WebR 조건부 예산 배분",
    budgetDesc: "WebR이 OOS 예측 승자이고 모든 채널이 안정성 게이트를 통과할 때만, fold 하한 한계효과가 가장 높은 채널부터 관측 최대 지출까지 배분합니다.",
    totalBudget: "총 주간 예산",
    currentBudget: "현재 합계",
    plannedBudget: "제안 예산",
    unallocated: "미배분",
    budgetBlocked: "예산 자동안 보류",
    predictiveOnly: "예측 기반 운영 후보이며 인과적 증분 효과 보장이 아닙니다. 실제 증액은 홀드아웃으로 확인하세요.",
    channel: "채널",
    observedRange: "관측 주간 지출 범위",
    foldStability: "fold 양수 비율",
    spendEvidence: "집행 주 · 지출 CV",
    status: "판정",
    marginalCpa: "한계 CPA",
    marginalRoas: "한계 ROAS",
    change: "변경",
    predictedIncrement: "조건부 예측 증분",
    reason: {
      "insufficient-oos-folds": "OOS fold 2개 미만",
      "unstable-fold-coefficient": "fold별 채널 계수 불안정",
      // 같은 사유 키는 같은 말을 해야 한다 — 게이트가 두 축이므로 둘 다 적는다(D-18).
      "sparse-active-weeks": "집행 기간이 짧음 (20주 미만 또는 전체의 20% 미만)",
      "recently-inactive-channel": "최근 12주 집행 근거 부족",
      "insufficient-spend-variation": "지출 변동 부족",
      "high-collinearity": "채널 공선성 · 묶음 해석 필요",
      "outside-observed-spend-range": "증액 후 관측 지출 상한 초과",
      "non-positive-marginal-lower-bound": "한계효과 fold 하한 비양수",
      "webr-not-predictive-winner": "WebR이 OOS 예측 승자가 아님",
      "insufficient-channels": "비교 가능한 채널 2개 미만",
      "channel-gate-failed": "하나 이상의 채널 게이트 보류",
      "budget-below-observed-minimums": "총예산이 관측 최소 지출 합보다 작음",
      "observed-range-or-positive-marginal-limit": "관측 상한 또는 양수 한계효과 한도",
    },
  },
  en: {
    title: "MMM result model",
    desc: "Bayesian and WebR are compared automatically on the same time-ordered validation windows. The materially lower-error model opens first, and you can switch between both results below.",
    run: "Retry WebR",
    loading: "Evaluating R glmnet candidates across time-ordered folds…",
    blocked: (n, required, reason) => reason === "insufficient_comparable_history" && n >= required
      ? `${n || 0} weeks are available, but two shared time-ordered validation windows could not be formed. Check weekly continuity and missing values.`
      : `${n || 0} weeks are available. Comparing both models on at least two matching time-ordered windows requires ${required || 120} weeks.`,
    failed: "The WebR MMM comparison did not complete. The current MMM result is unchanged.",
    candidate: "Predictive-accuracy winner: WebR Elastic-net",
    candidateBody: (gain) => `WebR reduced WMAPE by ${gain}% versus Bayesian across the same multiple windows, so the WebR result is selected by default.`,
    keep: "Predictive-accuracy winner: Bayesian MMM",
    keepBody: (gain) => `Bayesian MMM has equal or ${gain}% lower WMAPE than WebR in the same time-ordered validation, so Bayesian is selected by default.`,
    validate: "Predictive winner withheld: insufficient validation",
    validateBody: (difference) => `The observed error difference is ${difference}. Both models remain available, but fewer than two comparable windows or a relative improvement below 5% prevents an automatic winner.`,
    bayesian: "Bayesian MMM",
    webr: "WebR Elastic-net",
    selected: "Selected",
    calculating: "Calculating automatically",
    unavailable: "Unavailable",
    lowerIsBetter: "WMAPE · lower is better",
    bayesianDetail: "The channel contribution, response curves, and budget diagnostics below use Bayesian MMM.",
    modelChoice: "Choose result model",
    oosWmape: "Time-ordered OOS WMAPE",
    selectedBadge: "Current result",
    recommendedBadge: "Predictive pick",
    fitStep: "How much of actual performance did the model explain?",
    fitStepDesc: "Compare actuals with the in-sample fitted series first, then use time-ordered OOS WMAPE for generalization performance.",
    actual: "Actual",
    fitted: "WebR fitted",
    inSampleR2: "In-sample R²",
    inSampleWmape: "Training WMAPE",
    oosFoldRange: "OOS fold range",
    rmse: "RMSE",
    fitCaveat: "R² and training WMAPE describe historical fit; OOS WMAPE measures error on unseen future windows. None of them identifies causality.",
    driverStep: "What explained performance?",
    driverStepDesc: "Shows how channels, trend, seasonality, and events added to or subtracted from each week's fitted value. This is predictive decomposition, not causal attribution.",
    weeklyContribution: "Weekly predictive contribution",
    driver: "Driver",
    driverType: "Type",
    weeklyMean: "Weekly mean contribution",
    rmsShare: "RMS magnitude share",
    baseline: "Baseline demand",
    media: "Media channel",
    control: "Non-media",
    coefficientStep: "Did channel effects persist across validation windows?",
    coefficientStepDesc: "WebR regularizes multiple carryover candidates per channel together. The ranges below come from refits in validation folds; they are not confidence intervals or posteriors.",
    coefficient: "Summed coefficient",
    nonzeroTerms: "Selected carryovers",
    coefficientFoldRange: "Fold coefficient range",
    allCoefficients: "All coefficients, including trend, seasonality, and events",
    term: "Model term",
    modelSetup: "Model setup",
    responseStep: "How does prediction change when spend changes?",
    budgetStep: "Is a budget change safe enough to recommend?",
    foldLower: "Validation-fold lower",
    foldUpper: "Validation-fold upper",
    importance: "WebR predictive importance",
    caveat: "Importance sums |coefficient × standard deviation| across adstock candidates for the same channel. It is not current MMM channel contribution or a causal effect.",
    responseTitle: "Channel predictive response curves",
    responseDesc: "This is a conditional next-week predictive increment with recent carryover held fixed. It is not an experimentally identified causal effect. Curves and fold ranges stay inside observed weekly spend.",
    spendAxis: "Weekly spend",
    responseAxis: "Predictive increment",
    current: "Recent 12-week average",
    marginal: "Next-increment marginal effect",
    saturation: "Current saturation level",
    foldRange: "Validation-fold range",
    gateTitle: "Budget recommendation safety gates",
    gatePass: "Pass",
    gateHold: "Hold",
    budgetTitle: "Conditional WebR budget allocation",
    budgetDesc: "Only when WebR wins OOS prediction and every channel clears stability gates, budget is allocated by the highest fold-lower-bound marginal response up to observed spend maxima.",
    totalBudget: "Total weekly budget",
    currentBudget: "Current total",
    plannedBudget: "Proposed budget",
    unallocated: "Unallocated",
    budgetBlocked: "Automatic budget plan withheld",
    predictiveOnly: "This is a predictive operating candidate, not guaranteed causal incrementality. Confirm material changes with a holdout.",
    channel: "Channel",
    observedRange: "Observed weekly spend range",
    foldStability: "Positive-fold share",
    spendEvidence: "Active weeks · spend CV",
    status: "Status",
    marginalCpa: "Marginal CPA",
    marginalRoas: "Marginal ROAS",
    change: "Change",
    predictedIncrement: "Conditional predictive increment",
    reason: {
      "insufficient-oos-folds": "Fewer than 2 OOS folds",
      "unstable-fold-coefficient": "Unstable channel coefficient across folds",
      "sparse-active-weeks": "Fewer than 20 active weeks",
      "recently-inactive-channel": "Insufficient activity in the latest 12 weeks",
      "insufficient-spend-variation": "Insufficient spend variation",
      "high-collinearity": "Channel collinearity · grouped interpretation required",
      "outside-observed-spend-range": "Increment exceeds observed spend maximum",
      "non-positive-marginal-lower-bound": "Non-positive marginal fold lower bound",
      "webr-not-predictive-winner": "WebR is not the OOS predictive winner",
      "insufficient-channels": "Fewer than 2 comparable channels",
      "channel-gate-failed": "At least one channel gate is held",
      "budget-below-observed-minimums": "Budget is below the sum of observed minima",
      "observed-range-or-positive-marginal-limit": "Observed ceiling or positive-marginal limit",
    },
  },
};

const NOOP = () => {};

const DRIVER_LABELS = {
  Baseline: { ko: "기본 수요", en: "Baseline demand" },
  Trend: { ko: "추세", en: "Trend" },
  Seasonality: { ko: "계절성", en: "Seasonality" },
  Events: { ko: "이벤트", en: "Events" },
  "Regime change": { ko: "구조 변화", en: "Regime change" },
  "Industry controls": { ko: "업계 현황", en: "Industry controls" },
};

export function webRMmmDisplayLabel(value, locale = "ko") {
  const raw = String(value || "").trim();
  if (DRIVER_LABELS[raw]) return DRIVER_LABELS[raw][locale] || DRIVER_LABELS[raw].ko;
  const cleaned = raw
    .replace(/^control_/i, "")
    .replace(/^media_/i, "")
    .replace(/_adstock_[\d.]+$/i, "")
    .replace(/_(spend|cost|budget)$/i, "")
    .replace(/_/g, " ")
    .trim();
  return cleaned.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) || raw;
}

export default function WebRMmmAdvanced({
  mmm,
  signature,
  locale = "ko",
  source = "csv",
  currency = "KRW",
  selectedModel = "bayesian",
  onSelectModel = NOOP,
}) {
  const T = COPY[locale] || COPY.ko;
  const requestRef = useRef(0);
  const autoSignatureRef = useRef(null);
  const fitChartRef = useRef(null);
  const fitChartInstance = useRef(null);
  const driverChartRef = useRef(null);
  const driverChartInstance = useRef(null);
  const responseChartRef = useRef(null);
  const responseChartInstance = useRef(null);
  const [run, setRun] = useState({ status: "idle", signature: null, result: null });
  const [selectedChannelKey, setSelectedChannelKey] = useState(null);
  const [budgetInput, setBudgetInput] = useState({ signature: null, value: null });
  const input = useMemo(() => prepareMmmElasticNetInput({ panel: mmm?.panel, run: mmm?.run, target: mmm?.target }), [mmm]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  const execute = useCallback(async () => {
    if (!input.ok) return;
    const requestId = ++requestRef.current;
    setRun({ status: "loading", signature, result: null });
    onSelectModel("bayesian");
    trackProductEvent("analysis_started", {
      tool_id: "5-18", source, row_count: input.n, analysis_type: "webr_mmm_elastic_net", locale,
    });
    try {
      const result = await runWebRMmmElasticNet(input);
      if (requestId !== requestRef.current) return;
      setRun({ status: "complete", signature, result });
      trackProductEvent("analysis_completed", {
        tool_id: "5-18", source, row_count: input.n, analysis_type: "webr_mmm_elastic_net", result_state: result.status, locale,
      });
    } catch {
      if (requestId !== requestRef.current) return;
      setRun({ status: "failed", signature, result: null });
      onSelectModel("bayesian");
      trackProductEvent("analysis_completed", {
        tool_id: "5-18", source, row_count: input.n, analysis_type: "webr_mmm_elastic_net", result_state: "failed", locale,
      });
    }
  }, [input, locale, onSelectModel, signature, source]);

  useEffect(() => {
    if (!signature || !input.ok || autoSignatureRef.current === signature) return;
    autoSignatureRef.current = signature;
    execute();
  }, [execute, input.ok, signature]);

  useEffect(() => {
    if (!input.ok) onSelectModel("bayesian");
  }, [input.ok, onSelectModel]);

  const visible = run.signature === signature ? run : { status: "idle", result: null };
  const result = visible.result;
  const observedDifference = Number.isFinite(result?.relativeGain)
    ? result.relativeGain > 0
      ? `${T.webr} ${Math.abs(result.relativeGain * 100).toFixed(1)}% ${locale === "en" ? "lower" : "낮음"}`
      : `${T.bayesian} ${Math.abs(result.relativeGain * 100).toFixed(1)}% ${locale === "en" ? "lower" : "낮음"}`
    : T.unavailable;
  const verdict = result?.recommendation === "predictive_replacement_candidate"
    ? { title: T.candidate, body: T.candidateBody((result.relativeGain * 100).toFixed(1)), tone: "info" }
    : result?.recommendation === "keep_bayesian"
      ? { title: T.keep, body: T.keepBody(Math.abs(result.relativeGain * 100).toFixed(1)), tone: "warn" }
      : { title: T.validate, body: T.validateBody(observedDifference), tone: "info" };
  const channelModels = useMemo(() => result?.channelModels || [], [result]);
  const defaultChannel = useMemo(() => channelModels.slice().sort((left, right) => (
    (Number(right.recentSpend) || 0) - (Number(left.recentSpend) || 0)
      || String(left.key).localeCompare(String(right.key))
  ))[0] || null, [channelModels]);
  const effectiveChannel = channelModels.find((channel) => channel.key === selectedChannelKey) || defaultChannel;
  const fit = result?.fit || null;
  const driverSeries = useMemo(() => (fit?.drivers || []).filter((driver) => (
    driver.kind !== "baseline" && driver.values?.some((value) => Math.abs(Number(value) || 0) > 1e-10)
  )), [fit]);
  const responseCurve = useMemo(() => buildElasticNetResponseCurve(effectiveChannel, { steps: 48 }), [effectiveChannel]);
  const increment = currency === "KRW" ? 1_000_000 : 1_000;
  const currentBudget = channelModels.reduce((sum, channel) => sum + (Number(channel.recentSpend) || 0), 0);
  const effectiveBudget = budgetInput.signature === signature && budgetInput.value != null
    ? budgetInput.value
    : currentBudget;
  const gateRows = useMemo(() => channelModels.map((channel) => ({
    channel,
    gate: evaluateElasticNetChannelGate(channel, { folds: result?.folds || 0, increment }),
  })), [channelModels, increment, result?.folds]);
  const budgetPlan = useMemo(() => optimizeElasticNetBudget(channelModels, effectiveBudget, {
    folds: result?.folds || 0,
    increment,
    predictiveWinner: result?.recommendation === "predictive_replacement_candidate",
  }), [channelModels, effectiveBudget, increment, result?.folds, result?.recommendation]);

  useEffect(() => {
    if (result?.status !== "complete") return;
    onSelectModel(result.recommendation === "predictive_replacement_candidate" ? "webr" : "bayesian");
  }, [onSelectModel, result]);

  useEffect(() => {
    if (fitChartInstance.current) {
      fitChartInstance.current.destroy();
      fitChartInstance.current = null;
    }
    if (selectedModel !== "webr" || !fit?.actual?.length || !fitChartRef.current) return undefined;
    const common = chartCommonOpts();
    fitChartInstance.current = new Chart(fitChartRef.current.getContext("2d"), {
      type: "line",
      data: {
        labels: fit.labels,
        datasets: [
          { label: T.actual, data: fit.actual, borderColor: CHART_THEME.muted, pointRadius: 0, borderWidth: 2, tension: 0.18 },
          { label: T.fitted, data: fit.fitted, borderColor: CHART_THEME.primary, pointRadius: 0, borderWidth: 2.4, tension: 0.18 },
        ],
      },
      options: {
        ...common,
        scales: {
          ...common.scales,
          y: { ...common.scales.y, beginAtZero: false },
        },
      },
    });
    requestAnimationFrame(() => fitChartInstance.current?.resize());
    return () => {
      fitChartInstance.current?.destroy();
      fitChartInstance.current = null;
    };
  }, [T, fit, selectedModel]);

  useEffect(() => {
    if (driverChartInstance.current) {
      driverChartInstance.current.destroy();
      driverChartInstance.current = null;
    }
    if (selectedModel !== "webr" || !driverSeries.length || !driverChartRef.current) return undefined;
    const common = chartCommonOpts();
    driverChartInstance.current = new Chart(driverChartRef.current.getContext("2d"), {
      type: "line",
      data: {
        labels: fit.labels,
        datasets: driverSeries.map((driver, index) => ({
          label: webRMmmDisplayLabel(driver.name, locale),
          data: driver.values,
          borderColor: CHART_THEME.colors[index % CHART_THEME.colors.length],
          backgroundColor: CHART_THEME.colors[index % CHART_THEME.colors.length],
          pointRadius: 0,
          borderWidth: driver.kind === "media" ? 2 : 1.5,
          borderDash: driver.kind === "media" ? [] : [5, 4],
          tension: 0.18,
        })),
      },
      options: {
        ...common,
        plugins: {
          ...common.plugins,
          legend: { ...common.plugins.legend, position: "bottom", align: "start" },
        },
      },
    });
    requestAnimationFrame(() => driverChartInstance.current?.resize());
    return () => {
      driverChartInstance.current?.destroy();
      driverChartInstance.current = null;
    };
  }, [T, driverSeries, fit, locale, selectedModel]);

  useEffect(() => {
    if (responseChartInstance.current) {
      responseChartInstance.current.destroy();
      responseChartInstance.current = null;
    }
    if (selectedModel !== "webr" || !responseCurve?.points?.length || !responseChartRef.current) return undefined;
    const common = chartCommonOpts();
    const datasets = [
      {
        label: T.responseAxis,
        data: responseCurve.points.map((point) => ({ x: point.spend, y: point.mean })),
        borderColor: CHART_THEME.primary,
        backgroundColor: CHART_THEME.primary,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: T.foldLower,
        data: responseCurve.points.map((point) => ({ x: point.spend, y: point.low })),
        borderColor: CHART_THEME.muted,
        backgroundColor: CHART_THEME.muted,
        borderDash: [5, 4],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: T.foldUpper,
        data: responseCurve.points.map((point) => ({ x: point.spend, y: point.high })),
        borderColor: CHART_THEME.muted,
        backgroundColor: CHART_THEME.muted,
        borderDash: [5, 4],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.25,
      },
    ];
    const currentPoint = elasticNetResponseAt(effectiveChannel, responseCurve.currentSpend);
    datasets.push({
      label: T.current,
      data: [{ x: responseCurve.currentSpend, y: currentPoint.mean }],
      borderColor: CHART_THEME.accent,
      backgroundColor: CHART_THEME.accent,
      pointRadius: 5,
      pointHoverRadius: 7,
      showLine: false,
    });
    responseChartInstance.current = new Chart(responseChartRef.current.getContext("2d"), {
      type: "line",
      data: { datasets },
      options: {
        ...common,
        parsing: false,
        scales: {
          x: { ...common.scales.x, type: "linear", title: { display: true, text: `${T.spendAxis} (${currency})`, color: CHART_THEME.muted } },
          y: { ...common.scales.y, title: { display: true, text: T.responseAxis, color: CHART_THEME.muted } },
        },
      },
    });
    requestAnimationFrame(() => responseChartInstance.current?.resize());
    return () => {
      if (responseChartInstance.current) {
        responseChartInstance.current.destroy();
        responseChartInstance.current = null;
      }
    };
  }, [T, currency, effectiveChannel, responseCurve, selectedModel]);

  if (!mmm?.panel || !mmm?.run) return null;

  const bayesianWmape = input.baselineWmape;
  const select = (model) => onSelectModel(model);
  const onModelKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const choices = Array.from(event.currentTarget.parentElement?.querySelectorAll('[role="radio"]:not(:disabled)') || []);
    if (!choices.length) return;
    event.preventDefault();
    const current = Math.max(0, choices.indexOf(event.currentTarget));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? choices.length - 1
        : (current + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + choices.length) % choices.length;
    choices[nextIndex].focus();
    choices[nextIndex].click();
  };
  const isRevenueTarget = /revenue|sales|매출|수익/i.test(String(result?.target || ""));
  const formatSpend = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return currency === "KRW"
      ? `₩${Math.round(number).toLocaleString(locale === "en" ? "en-US" : "ko-KR")}`
      : `${currency} ${number.toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 0 })}`;
  };
  const formatOutcome = (value) => Number.isFinite(Number(value))
    ? Number(value).toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: 2 })
    : "—";
  const selectedMarginal = effectiveChannel
    ? elasticNetMarginalAt(effectiveChannel, effectiveChannel.recentSpend, increment)
    : null;
  const formatEfficiency = (marginal) => {
    if (!(marginal?.mean > 0)) return "—";
    if (isRevenueTarget) return `${(marginal.mean / increment).toFixed(3)}x`;
    return formatSpend(increment / marginal.mean);
  };
  const formatEfficiencyRange = (marginal) => {
    if (!(marginal?.low > 0) || !(marginal?.high > 0)) return "—";
    if (isRevenueTarget) return `${(marginal.low / increment).toFixed(3)}x–${(marginal.high / increment).toFixed(3)}x`;
    return `${formatSpend(increment / marginal.high)}–${formatSpend(increment / marginal.low)}`;
  };
  const formatMetric = (value, digits = 1) => Number.isFinite(Number(value))
    ? Number(value).toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: digits })
    : "—";
  const formatCoefficient = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return Math.abs(number) > 0 && Math.abs(number) < 0.001
      ? number.toExponential(2)
      : number.toFixed(4);
  };
  const coefficientRange = (values) => {
    const finite = (values || []).map(Number).filter(Number.isFinite);
    return finite.length ? `${formatCoefficient(Math.min(...finite))}–${formatCoefficient(Math.max(...finite))}` : "—";
  };
  const foldWmapeRange = result?.foldWmapes?.length
    ? `${formatMetric(Math.min(...result.foldWmapes))}%–${formatMetric(Math.max(...result.foldWmapes))}%`
    : "—";
  const driverRows = (fit?.drivers || []).slice().sort((left, right) => {
    const order = { baseline: 0, media: 1, control: 2 };
    return (order[left.kind] ?? 3) - (order[right.kind] ?? 3) || right.rmsContribution - left.rmsContribution;
  });
  const webRRecommended = result?.recommendation === "predictive_replacement_candidate";

  return (
    <section className="block" id="s-mmm-webr-challenger">
      <h2 className="section-title"><span className="ix">AUTO</span>{T.title}</h2>
      <p className="muted" style={{ fontSize: "12px", margin: "0 0 12px", lineHeight: 1.55 }}>{T.desc}</p>
      <div className="mmm-model-switcher" role="radiogroup" aria-label={T.modelChoice}>
        <button type="button" role="radio" aria-checked={selectedModel === "bayesian"} className={`mmm-model-choice ${selectedModel === "bayesian" ? "is-selected" : ""}`} onClick={() => select("bayesian")} onKeyDown={onModelKeyDown}>
          <span className="mmm-model-choice__radio" aria-hidden="true" />
          <span className="mmm-model-choice__copy"><strong>{T.bayesian}</strong><small>{T.oosWmape} · {T.lowerIsBetter}</small></span>
          <span className="mmm-model-choice__metric">{Number.isFinite(bayesianWmape) ? `${bayesianWmape.toFixed(1)}%` : "—"}</span>
          <span className="mmm-model-choice__badges">{result?.recommendation === "keep_bayesian" && <em>{T.recommendedBadge}</em>}{selectedModel === "bayesian" && <b>{T.selectedBadge}</b>}</span>
        </button>
        <button type="button" role="radio" aria-checked={selectedModel === "webr"} className={`mmm-model-choice ${selectedModel === "webr" ? "is-selected" : ""}`} onClick={() => result?.status === "complete" && select("webr")} onKeyDown={onModelKeyDown} disabled={result?.status !== "complete"}>
          <span className="mmm-model-choice__radio" aria-hidden="true" />
          <span className="mmm-model-choice__copy"><strong>{T.webr}</strong><small>{T.oosWmape} · {T.lowerIsBetter}</small></span>
          <span className="mmm-model-choice__metric">{result?.status === "complete" ? `${result.wmape.toFixed(1)}%` : visible.status === "failed" || !input.ok ? "—" : "…"}</span>
          <span className="mmm-model-choice__badges">{webRRecommended && <em>{T.recommendedBadge}</em>}{selectedModel === "webr" && <b>{T.selectedBadge}</b>}{visible.status === "loading" || visible.status === "idle" ? <small>{T.calculating}</small> : null}</span>
        </button>
      </div>
      {!input.ok ? (
        <div className="required-banner"><p style={{ margin: 0 }}>{T.blocked(input.n, input.requiredObservations, input.reason)}</p></div>
      ) : (
        <>
          {(visible.status === "loading" || visible.status === "idle") && <p className="muted" style={{ fontSize: "12px" }}>{T.loading}</p>}
          {visible.status === "failed" && <div className="required-banner"><p style={{ margin: 0 }}>{T.failed}</p><button className="ab-button" style={{ marginTop: "8px" }} onClick={execute}>{T.run}</button></div>}
          {result?.status === "complete" && (
            <div>
              <div className={`callout ${verdict.tone}`}><div className="body"><strong>{verdict.title}</strong><p>{verdict.body}</p></div></div>
              <ResultActionCard
                tone={verdict.tone === "good" ? "good" : verdict.tone === "bad" ? "bad" : "neutral"}
                title={locale === "en" ? "Model comparison conclusion" : "모델 비교 결론"}
                headline={verdict.title}
                points={[{ text: verdict.body }]}
                stats={[
                  { label: T.bayesian, value: Number.isFinite(bayesianWmape) ? `${bayesianWmape.toFixed(1)}%` : "—", detail: T.oosWmape },
                  { label: T.webr, value: Number.isFinite(result.wmape) ? `${result.wmape.toFixed(1)}%` : "—", detail: T.oosWmape },
                  { label: T.oosFoldRange, value: String(result.folds || "—") },
                ]}
                workbookExport={() => ({
                  toolId: "5-18-mmm",
                  toolTitle: locale === "en" ? "MMM model comparison" : "MMM 모델 비교",
                  calculationMode: "hybrid_engine_output",
                  calculationTables: [{
                    name: "MMM_MODEL_COMPARISON",
                    title: locale === "en" ? "Bayesian vs WebR OOS comparison" : "Bayesian·WebR OOS 비교",
                    note: locale === "en" ? "Model fitting and OOS scores are engine outputs; the score gap is a formula" : "모델 적합과 OOS 점수는 엔진 출력이고 오차 차이는 수식",
                    rows: [
                      ["bayesian_wmape_engine", "webr_wmape_engine", "webr_minus_bayesian", "folds", "horizon", "alpha_engine", "lambda_factor_engine", "nonzero_features_engine"],
                      [bayesianWmape ?? "", result.wmape ?? "", { formula: "=B2-A2" }, result.folds || 0, result.horizon || 0, result.alpha ?? "", result.lambdaFactor ?? "", result.nonzeroFeatures ?? ""],
                    ],
                  }, {
                    name: "WEBR_DRIVER_OUTPUT",
                    title: locale === "en" ? "WebR driver contribution output" : "WebR 동인 기여 출력",
                    note: locale === "en" ? "Driver coefficients and contributions are engine outputs" : "동인 계수·기여는 엔진 출력",
                    rows: [
                      ["driver", "kind", "weekly_mean_contribution_engine", "rms_contribution_engine", "rms_share_engine"],
                      ...driverRows.map((driver) => [driver.name, driver.kind, driver.meanContribution ?? "", driver.rmsContribution ?? "", driver.rmsShare ?? ""]),
                    ],
                  }],
                  method: {
                    name: "Bayesian MMM vs WebR elastic-net challenger",
                    version: "mmm-model-comparison-v1",
                    limitations: [locale === "en" ? "Neither model is refit in the workbook; lower OOS error does not establish causality." : "두 모델 모두 워크북에서 재학습되지 않으며 낮은 OOS 오차가 인과성을 뜻하지 않습니다."],
                  },
                })}
                toolId="5-18"
                analysisType="webr-mmm-comparison"
                analysisKey={`${signature}:${result.wmape}:${bayesianWmape}`}
                locale={locale}
                decisionReview={false}
              />
              {selectedModel === "webr" ? <div className="mmm-result-flow">
                <section className="mmm-result-step" aria-labelledby="mmm-webr-fit-title">
                  <div className="mmm-result-step__head"><span>01</span><div><h3 id="mmm-webr-fit-title">{T.fitStep}</h3><p>{T.fitStepDesc}</p></div></div>
                  {fit ? <>
                    <div className="mmm-metric-grid">
                      <div className="mmm-metric-card"><small>{T.inSampleR2}</small><strong>{formatMetric(fit.r2, 3)}</strong></div>
                      <div className="mmm-metric-card"><small>{T.inSampleWmape}</small><strong>{formatMetric(fit.wmape)}%</strong></div>
                      <div className="mmm-metric-card is-primary"><small>{T.oosWmape}</small><strong>{formatMetric(result.wmape)}%</strong><em>{T.oosFoldRange} {foldWmapeRange}</em></div>
                      <div className="mmm-metric-card"><small>{T.rmse}</small><strong>{formatOutcome(fit.rmse)}</strong></div>
                    </div>
                    <div className="chart-container mmm-result-chart"><canvas ref={fitChartRef} /></div>
                    <p className="mmm-result-note">{T.fitCaveat}</p>
                  </> : <div className="required-banner"><p style={{ margin: 0 }}>{T.unavailable}</p></div>}
                  <details className="mmm-result-details mmm-model-setup-details"><summary>{T.modelSetup}</summary><div className="mmm-model-setup"><span>folds {result.folds} × {result.horizon}</span><span>α {result.alpha.toFixed(2)}</span><span>λ factor {formatCoefficient(result.lambdaFactor)}</span><span>nonzero {result.nonzeroFeatures}</span></div></details>
                </section>

                <section className="mmm-result-step" aria-labelledby="mmm-webr-driver-title">
                  <div className="mmm-result-step__head"><span>02</span><div><h3 id="mmm-webr-driver-title">{T.driverStep}</h3><p>{T.driverStepDesc}</p></div></div>
                  {driverSeries.length ? <div className="chart-container mmm-result-chart"><canvas ref={driverChartRef} /></div> : null}
                  <div className="table-wrap"><table className="data mmm-webr-table">
                    <thead><tr><th>{T.driver}</th><th>{T.driverType}</th><th className="tnum">{T.weeklyMean}</th><th className="tnum">{T.rmsShare}</th></tr></thead>
                    <tbody>{driverRows.map((driver) => <tr key={`${driver.kind}:${driver.name}`}>
                      <td><strong>{webRMmmDisplayLabel(driver.name, locale)}</strong></td>
                      <td>{driver.kind === "baseline" ? T.baseline : driver.kind === "media" ? T.media : T.control}</td>
                      <td className="tnum">{formatOutcome(driver.meanContribution)}</td>
                      <td className="tnum">{(driver.rmsShare * 100).toFixed(1)}%</td>
                    </tr>)}</tbody>
                  </table></div>
                </section>

                <section className="mmm-result-step" aria-labelledby="mmm-webr-coef-title">
                  <div className="mmm-result-step__head"><span>03</span><div><h3 id="mmm-webr-coef-title">{T.coefficientStep}</h3><p>{T.coefficientStepDesc}</p></div></div>
                  <div className="table-wrap"><table className="data mmm-webr-table">
                    <thead><tr><th>{T.channel}</th><th className="tnum">{T.coefficient}</th><th className="tnum">{T.nonzeroTerms}</th><th className="tnum">{T.coefficientFoldRange}</th><th className="tnum">{T.foldStability}</th></tr></thead>
                    <tbody>{channelModels.map((channel) => <tr key={channel.key}>
                      <td><strong>{webRMmmDisplayLabel(channel.label, locale)}</strong></td>
                      <td className="tnum">{formatCoefficient(channel.coefficient)}</td>
                      <td className="tnum">{channel.terms.filter((term) => term.coefficient > 1e-10).length}/{channel.terms.length}</td>
                      <td className="tnum">{coefficientRange(channel.foldChannelCoefficients)}</td>
                      <td className="tnum">{channel.hasCompleteFoldEvidence ? `${(channel.positiveFoldShare * 100).toFixed(0)}%` : "—"}</td>
                    </tr>)}</tbody>
                  </table></div>
                  <details className="mmm-result-details"><summary>{T.allCoefficients}</summary>
                    <div className="table-wrap"><table className="data mmm-webr-table">
                      <thead><tr><th>{T.driver}</th><th>{T.term}</th><th className="tnum">{T.coefficient}</th><th className="tnum">{T.coefficientFoldRange}</th></tr></thead>
                      <tbody>{(result.coefficients || []).map((row) => <tr key={row.name}>
                        <td>{webRMmmDisplayLabel(row.group, locale)}</td><td>{webRMmmDisplayLabel(row.name, locale)}</td><td className="tnum">{formatCoefficient(row.coefficient)}</td><td className="tnum">{coefficientRange(row.foldCoefficients)}</td>
                      </tr>)}</tbody>
                    </table></div>
                  </details>
                </section>

                <section className="mmm-result-step" aria-labelledby="mmm-webr-response-title">
                  <div className="mmm-result-step__head"><span>04</span><div><h3 id="mmm-webr-response-title">{T.responseStep}</h3><p>{T.responseDesc}</p></div></div>
                  <div className="mmm-channel-selector" role="group" aria-label={T.responseTitle}>
                    {channelModels.map((channel) => (
                      <button type="button" aria-pressed={effectiveChannel?.key === channel.key} className={effectiveChannel?.key === channel.key ? "is-selected" : ""} key={channel.key} onClick={() => setSelectedChannelKey(channel.key)}>{webRMmmDisplayLabel(channel.label, locale)}</button>
                    ))}
                  </div>
                  {responseCurve && effectiveChannel ? <>
                    <div className="chart-container mmm-result-chart"><canvas ref={responseChartRef} /></div>
                    <div className="mmm-metric-grid">
                      <div className="mmm-metric-card"><small>{T.current}</small><strong>{formatSpend(effectiveChannel.recentSpend)}</strong></div>
                      <div className="mmm-metric-card"><small>{T.marginal} · {formatSpend(increment)}</small><strong>+{formatOutcome(selectedMarginal?.mean)}</strong><em>{selectedMarginal?.low != null ? `${T.foldRange} ${formatOutcome(selectedMarginal.low)}–${formatOutcome(selectedMarginal.high)}` : "—"}</em></div>
                      <div className="mmm-metric-card"><small>{isRevenueTarget ? T.marginalRoas : T.marginalCpa}</small><strong>{formatEfficiency(selectedMarginal)}</strong><em>{T.foldRange} {formatEfficiencyRange(selectedMarginal)}</em></div>
                      <div className="mmm-metric-card"><small>{T.saturation}</small><strong>{selectedMarginal?.saturation == null ? "—" : `${(selectedMarginal.saturation * 100).toFixed(1)}%`}</strong></div>
                    </div>
                  </> : <div className="required-banner"><p style={{ margin: 0 }}>{T.unavailable}</p></div>}
                </section>

                <section className="mmm-result-step" aria-labelledby="mmm-webr-budget-title">
                  <div className="mmm-result-step__head"><span>05</span><div><h3 id="mmm-webr-budget-title">{T.budgetStep}</h3><p>{T.budgetDesc}</p></div></div>
                  <h4>{T.gateTitle}</h4>
                  <div className="table-wrap"><table className="data mmm-webr-table">
                    <thead><tr><th>{T.channel}</th><th className="tnum">{T.foldStability}</th><th className="tnum">{T.spendEvidence}</th><th className="tnum">{T.observedRange}</th><th>{T.status}</th></tr></thead>
                    <tbody>{gateRows.map(({ channel, gate }) => <tr key={channel.key}>
                      <td>{webRMmmDisplayLabel(channel.label, locale)}{channel.collinearityGroup?.length > 1 ? <small className="muted" style={{ display: "block" }}>{channel.collinearityGroup.map((item) => webRMmmDisplayLabel(item, locale)).join(" + ")}</small> : null}</td>
                      <td className="tnum">{channel.hasCompleteFoldEvidence ? `${((channel.positiveFoldShare || 0) * 100).toFixed(0)}%` : "—"}</td>
                      <td className="tnum">{channel.activeWeeks} · {Number(channel.spendCv || 0).toFixed(2)}</td>
                      <td className="tnum">{formatSpend(channel.observedMin)}–{formatSpend(channel.observedMax)}</td>
                      <td><strong>{gate.eligible ? `✓ ${T.gatePass}` : `⚠ ${T.gateHold}`}</strong>{!gate.eligible ? <small className="muted" style={{ display: "block" }}>{gate.reasons.map((reason) => T.reason[reason] || reason).join(" · ")}</small> : null}</td>
                    </tr>)}</tbody>
                  </table></div>
                  <h4>{T.budgetTitle}</h4>
                  <div className="mmm-budget-input"><label>{T.totalBudget} <CommaNumberInput value={Math.round(effectiveBudget)} onCommit={(value) => setBudgetInput({ signature, value })} /></label><span>{T.currentBudget}: {formatSpend(currentBudget)}</span></div>
                  {budgetPlan.status === "blocked" ? (
                    <div className="required-banner"><strong>{T.budgetBlocked}</strong><p style={{ margin: ".35rem 0 0", fontSize: "11px" }}>{budgetPlan.reasons.map((reason) => T.reason[reason] || reason).join(" · ")}</p></div>
                  ) : <>
                    <div className="table-wrap"><table className="data mmm-webr-table">
                      <thead><tr><th>{T.channel}</th><th className="tnum">{T.currentBudget}</th><th className="tnum">{T.plannedBudget}</th><th className="tnum">{T.change}</th><th className="tnum">{T.predictedIncrement}</th></tr></thead>
                      <tbody>{budgetPlan.items.map((item) => <tr key={item.key}><td>{webRMmmDisplayLabel(item.label, locale)}</td><td className="tnum">{formatSpend(item.currentSpend)}</td><td className="tnum">{formatSpend(item.plannedSpend)}</td><td className="tnum">{formatSpend(item.plannedSpend - item.currentSpend)}</td><td className="tnum">{formatOutcome(item.response.mean)}</td></tr>)}</tbody>
                    </table></div>
                    {budgetPlan.unallocated > 0 ? <p className="mmm-result-note">{T.unallocated}: {formatSpend(budgetPlan.unallocated)} · {budgetPlan.reasons.map((reason) => T.reason[reason] || reason).join(" · ")}</p> : null}
                  </>}
                  <div className="callout warn"><div className="body"><p>{T.predictiveOnly}</p></div></div>
                </section>

                <details className="mmm-result-details"><summary>{T.importance}</summary>
                  <div className="table-wrap"><table className="data mmm-webr-table"><thead><tr><th>{T.driver}</th><th className="tnum">importance</th></tr></thead><tbody>{(result.importance || []).map((row) => <tr key={`${row.kind}:${row.name}`}><td>{webRMmmDisplayLabel(row.name, locale)}</td><td className="tnum">{row.importance.toFixed(3)}</td></tr>)}</tbody></table></div>
                  <p className="mmm-result-note">{T.caveat}</p>
                </details>
              </div> : <p className="muted" style={{ fontSize: "11px" }}>{T.bayesianDetail}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

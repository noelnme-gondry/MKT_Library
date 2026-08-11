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

const COPY = {
  ko: {
    title: "MMM 모델 자동 비교",
    desc: "분석을 시작하면 Bayesian MMM과 WebR Elastic-net을 같은 시간순 검증구간에서 자동 비교합니다. WebR 규제값은 각 검증시점 이전 이력 안에서만 고릅니다. 오차가 낮은 모델과 개선폭을 먼저 보여주고, 보고 싶은 결과를 직접 선택할 수 있습니다.",
    run: "WebR 다시 실행",
    loading: "R glmnet 후보와 시간순 검증을 계산 중입니다…",
    blocked: (n, required) => `현재 ${n || 0}주입니다. WebR MMM 챌린저는 최소 ${required || 78}주가 필요합니다.`,
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
      "sparse-active-weeks": "집행 20주 미만",
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
    title: "Automatic MMM model comparison",
    desc: "Starting the analysis automatically compares Bayesian MMM and WebR Elastic-net on the same time-ordered validation windows. WebR tuning uses only history available before each validation window. It shows the lower-error model and improvement first, while letting you choose which result to inspect.",
    run: "Retry WebR",
    loading: "Evaluating R glmnet candidates across time-ordered folds…",
    blocked: (n, required) => `${n || 0} weeks are available. The WebR MMM challenger requires at least ${required || 78}.`,
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
  const effectiveChannel = channelModels.find((channel) => channel.key === selectedChannelKey) || channelModels[0] || null;
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
        label: T.foldRange,
        data: responseCurve.points.map((point) => ({ x: point.spend, y: point.low })),
        borderColor: CHART_THEME.muted,
        backgroundColor: CHART_THEME.muted,
        borderDash: [5, 4],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: T.foldRange,
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

  return (
    <section className="block" id="s-mmm-webr-challenger">
      <h2 className="section-title"><span className="ix">AUTO</span>{T.title}</h2>
      <p className="muted" style={{ fontSize: "12px", margin: "0 0 12px", lineHeight: 1.55 }}>{T.desc}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px", marginBottom: "12px" }}>
        <button type="button" className={`stat-card ${selectedModel === "bayesian" ? "active" : ""}`} onClick={() => select("bayesian")} style={{ textAlign: "left", cursor: "pointer", border: selectedModel === "bayesian" ? "2px solid var(--primary)" : undefined }}>
          <div className="lbl">{T.bayesian} · {T.lowerIsBetter}</div>
          <div className="val">{Number.isFinite(bayesianWmape) ? `${bayesianWmape.toFixed(1)}%` : "—"}</div>
          <small>{selectedModel === "bayesian" ? `✓ ${T.selected}` : ""}</small>
        </button>
        <button type="button" className={`stat-card ${selectedModel === "webr" ? "active" : ""}`} onClick={() => result?.status === "complete" && select("webr")} disabled={result?.status !== "complete"} style={{ textAlign: "left", cursor: result?.status === "complete" ? "pointer" : "wait", border: selectedModel === "webr" ? "2px solid var(--primary)" : undefined }}>
          <div className="lbl">{T.webr} · {T.lowerIsBetter}</div>
          <div className="val">{result?.status === "complete" ? `${result.wmape.toFixed(1)}%` : visible.status === "failed" || !input.ok ? "—" : "…"}</div>
          <small>{selectedModel === "webr" ? `✓ ${T.selected}` : visible.status === "loading" || visible.status === "idle" ? T.calculating : !input.ok ? T.unavailable : ""}</small>
        </button>
      </div>
      {!input.ok ? (
        <div className="required-banner"><p style={{ margin: 0 }}>{T.blocked(input.n, input.requiredObservations)}</p></div>
      ) : (
        <>
          {(visible.status === "loading" || visible.status === "idle") && <p className="muted" style={{ fontSize: "12px" }}>{T.loading}</p>}
          {visible.status === "failed" && <div className="required-banner"><p style={{ margin: 0 }}>{T.failed}</p><button className="ab-button" style={{ marginTop: "8px" }} onClick={execute}>{T.run}</button></div>}
          {result?.status === "complete" && (
            <div>
              <div className={`callout ${verdict.tone}`}><div className="body"><strong>{verdict.title}</strong><p>{verdict.body}</p></div></div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "10px 0" }}>
                <div className="stat-card"><div className="lbl">folds · horizon</div><div className="val">{result.folds} · {result.horizon}</div></div>
                <div className="stat-card"><div className="lbl">α · nonzero</div><div className="val">{result.alpha.toFixed(2)} · {result.nonzeroFeatures}</div></div>
              </div>
              {selectedModel === "webr" ? <>
                <h3 className="section-title" style={{ fontSize: "13px" }}>{T.responseTitle}</h3>
                <p className="muted" style={{ fontSize: "11px", lineHeight: 1.55 }}>{T.responseDesc}</p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "10px 0" }}>
                  {channelModels.map((channel) => (
                    <button
                      type="button"
                      className={`ab-button${effectiveChannel?.key === channel.key ? " active" : ""}`}
                      key={channel.key}
                      onClick={() => setSelectedChannelKey(channel.key)}
                    >{channel.label}</button>
                  ))}
                </div>
                {responseCurve && effectiveChannel ? <>
                  <div className="chart-container" style={{ height: "280px" }}><canvas ref={responseChartRef} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px", margin: "10px 0 14px" }}>
                    <div className="stat-card"><div className="lbl">{T.current}</div><div className="val">{formatSpend(effectiveChannel.recentSpend)}</div></div>
                    <div className="stat-card"><div className="lbl">{T.marginal} · {formatSpend(increment)}</div><div className="val">+{formatOutcome(selectedMarginal?.mean)}</div><small>{selectedMarginal?.low != null ? `${T.foldRange} ${formatOutcome(selectedMarginal.low)}–${formatOutcome(selectedMarginal.high)}` : "—"}</small></div>
                    <div className="stat-card"><div className="lbl">{isRevenueTarget ? T.marginalRoas : T.marginalCpa}</div><div className="val">{formatEfficiency(selectedMarginal)}</div><small>{T.foldRange} {formatEfficiencyRange(selectedMarginal)}</small></div>
                    <div className="stat-card"><div className="lbl">{T.saturation}</div><div className="val">{selectedMarginal?.saturation == null ? "—" : `${(selectedMarginal.saturation * 100).toFixed(1)}%`}</div></div>
                  </div>
                </> : <div className="required-banner"><p style={{ margin: 0 }}>{T.unavailable}</p></div>}

                <h3 className="section-title" style={{ fontSize: "13px" }}>{T.gateTitle}</h3>
                <div className="table-wrap"><table className="data" style={{ fontSize: "11px" }}>
                  <thead><tr>
                    <th style={{ textAlign: "left" }}>{T.channel}</th>
                    <th style={{ textAlign: "right" }}>{T.foldStability}</th>
                    <th style={{ textAlign: "right" }}>{T.spendEvidence}</th>
                    <th style={{ textAlign: "right" }}>{T.observedRange}</th>
                    <th style={{ textAlign: "left" }}>{T.status}</th>
                  </tr></thead>
                  <tbody>{gateRows.map(({ channel, gate }) => <tr key={channel.key}>
                    <td>{channel.label}{channel.collinearityGroup?.length > 1 ? <small className="muted" style={{ display: "block" }}>{channel.collinearityGroup.join(" + ")}</small> : null}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{((channel.positiveFoldShare || 0) * 100).toFixed(0)}%</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{channel.activeWeeks} · {Number(channel.spendCv || 0).toFixed(2)}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{formatSpend(channel.observedMin)}–{formatSpend(channel.observedMax)}</td>
                    <td><strong>{gate.eligible ? `✓ ${T.gatePass}` : `⚠ ${T.gateHold}`}</strong>{!gate.eligible ? <small className="muted" style={{ display: "block" }}>{gate.reasons.map((reason) => T.reason[reason] || reason).join(" · ")}</small> : null}</td>
                  </tr>)}</tbody>
                </table></div>

                <h3 className="section-title" style={{ fontSize: "13px", marginTop: "16px" }}>{T.budgetTitle}</h3>
                <p className="muted" style={{ fontSize: "11px", lineHeight: 1.55 }}>{T.budgetDesc}</p>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
                  <label style={{ fontSize: "11px" }}>{T.totalBudget} <CommaNumberInput value={Math.round(effectiveBudget)} onCommit={(value) => setBudgetInput({ signature, value })} style={{ width: "140px", marginLeft: "6px" }} /></label>
                  <span className="muted" style={{ fontSize: "11px" }}>{T.currentBudget}: {formatSpend(currentBudget)}</span>
                </div>
                {budgetPlan.status === "blocked" ? (
                  <div className="required-banner"><strong>{T.budgetBlocked}</strong><p style={{ margin: ".35rem 0 0", fontSize: "11px" }}>{budgetPlan.reasons.map((reason) => T.reason[reason] || reason).join(" · ")}</p></div>
                ) : <>
                  <div className="table-wrap"><table className="data" style={{ fontSize: "11px" }}>
                    <thead><tr><th style={{ textAlign: "left" }}>{T.channel}</th><th style={{ textAlign: "right" }}>{T.currentBudget}</th><th style={{ textAlign: "right" }}>{T.plannedBudget}</th><th style={{ textAlign: "right" }}>{T.change}</th><th style={{ textAlign: "right" }}>{T.predictedIncrement}</th></tr></thead>
                    <tbody>{budgetPlan.items.map((item) => <tr key={item.key}><td>{item.label}</td><td className="tnum" style={{ textAlign: "right" }}>{formatSpend(item.currentSpend)}</td><td className="tnum" style={{ textAlign: "right" }}>{formatSpend(item.plannedSpend)}</td><td className="tnum" style={{ textAlign: "right" }}>{formatSpend(item.plannedSpend - item.currentSpend)}</td><td className="tnum" style={{ textAlign: "right" }}>{formatOutcome(item.response.mean)}</td></tr>)}</tbody>
                  </table></div>
                  {budgetPlan.unallocated > 0 ? <p className="muted" style={{ fontSize: "11px" }}>{T.unallocated}: {formatSpend(budgetPlan.unallocated)} · {budgetPlan.reasons.map((reason) => T.reason[reason] || reason).join(" · ")}</p> : null}
                </>}
                <div className="callout warn" style={{ marginTop: "10px" }}><div className="body"><p>{T.predictiveOnly}</p></div></div>

                <details style={{ marginTop: "12px" }}><summary>{T.importance}</summary>
                  <div className="table-wrap" style={{ marginTop: "8px" }}><table className="data" style={{ fontSize: "12px" }}>
                    <thead><tr><th style={{ textAlign: "left" }}>{locale === "en" ? "Driver" : "동인"}</th><th style={{ textAlign: "right" }}>importance</th></tr></thead>
                    <tbody>{result.importance.slice(0, 10).map((row) => <tr key={`${row.kind}:${row.name}`}><td>{row.name}</td><td className="tnum" style={{ textAlign: "right" }}>{row.importance.toFixed(3)}</td></tr>)}</tbody>
                  </table></div>
                  <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{T.caveat}</p>
                </details>
              </> : <p className="muted" style={{ fontSize: "11px" }}>{T.bayesianDetail}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

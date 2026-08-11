"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { prepareMmmElasticNetInput, runWebRMmmElasticNet } from "@/lib/analysis/webr/mmmElasticNet";

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
    robynSummary: "Robyn은 현재 브라우저 WebR에서 실행할 수 없습니다",
    robynBody: "Robyn 3.12.1 패키지는 WebR에 내려받을 수 있지만 필수 namespace인 prophet·reticulate가 WebR 바이너리 저장소에 없어 모델 실행 전에 로드가 실패합니다. 사용자 데이터를 서버로 보내지 않는 현재 구조에서 실제 실행 가능한 R 비교 모델만 표시합니다.",
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
    robynSummary: "Robyn cannot currently run in browser WebR",
    robynBody: "The Robyn 3.12.1 package can be downloaded into WebR, but loading fails before modeling because its required prophet and reticulate namespaces are not available in the WebR binary repository. Under the current no-server-data architecture, the UI exposes only an R model that actually runs in the browser.",
  },
};

const NOOP = () => {};

export default function WebRMmmAdvanced({
  mmm,
  signature,
  locale = "ko",
  source = "csv",
  selectedModel = "bayesian",
  onSelectModel = NOOP,
}) {
  const T = COPY[locale] || COPY.ko;
  const requestRef = useRef(0);
  const autoSignatureRef = useRef(null);
  const [run, setRun] = useState({ status: "idle", signature: null, result: null });
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
    : result?.recommendation === "keep_current_js"
      ? { title: T.keep, body: T.keepBody(Math.abs(result.relativeGain * 100).toFixed(1)), tone: "warn" }
      : { title: T.validate, body: T.validateBody(observedDifference), tone: "info" };

  useEffect(() => {
    if (result?.status !== "complete") return;
    onSelectModel(result.recommendation === "predictive_replacement_candidate" ? "webr" : "bayesian");
  }, [onSelectModel, result]);

  if (!mmm?.panel || !mmm?.run) return null;

  const bayesianWmape = input.baselineWmape;
  const select = (model) => onSelectModel(model);

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
                <h3 className="section-title" style={{ fontSize: "13px" }}>{T.importance}</h3>
                <div className="table-wrap"><table className="data" style={{ fontSize: "12px" }}>
                  <thead><tr><th style={{ textAlign: "left" }}>{locale === "en" ? "Driver" : "동인"}</th><th style={{ textAlign: "right" }}>importance</th></tr></thead>
                  <tbody>{result.importance.slice(0, 10).map((row) => <tr key={`${row.kind}:${row.name}`}><td>{row.name}</td><td className="tnum" style={{ textAlign: "right" }}>{row.importance.toFixed(3)}</td></tr>)}</tbody>
                </table></div>
                <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{T.caveat}</p>
              </> : <p className="muted" style={{ fontSize: "11px" }}>{T.bayesianDetail}</p>}
            </div>
          )}
        </>
      )}
      <div className="required-banner" style={{ marginTop: "10px" }}>
        <strong>{T.robynSummary}</strong>
        <p style={{ margin: ".35rem 0 0", fontSize: "11px", lineHeight: 1.55 }}>{T.robynBody}</p>
      </div>
    </section>
  );
}

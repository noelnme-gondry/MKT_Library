"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { prepareMmmElasticNetInput, runWebRMmmElasticNet } from "@/lib/analysis/webr/mmmElasticNet";

const COPY = {
  ko: {
    title: "WebR 고급 검증 · Elastic-net MMM 챌린저",
    desc: "원시 채널 지출에서 미래값을 보지 않는 고정 adstock 후보와 추세·계절·이벤트 특징을 만들고, R glmnet이 시간순 검증 안에서 규제 강도를 선택합니다. 현재 MMM과 같은 검증 주차에서 예측 오차를 비교하되, 기여도·인과효과를 대체하지 않습니다.",
    run: "WebR MMM 맞대결 실행",
    loading: "R glmnet 후보와 시간순 검증을 계산 중입니다…",
    blocked: (n, required) => `현재 ${n || 0}주입니다. WebR MMM 챌린저는 최소 ${required || 78}주가 필요합니다.`,
    failed: "WebR MMM 비교를 완료하지 못했습니다. 현재 MMM 결과에는 영향이 없습니다.",
    candidate: "예측 엔진 교체 후보",
    candidateBody: (gain) => `같은 복수 시간창에서 WebR의 WMAPE가 ${gain}% 개선됐습니다. 예측 경로의 교체 후보로만 표시하며, 채널 기여·예산 결정은 별도 검증 전까지 현재 MMM을 유지합니다.`,
    keep: "현재 JS MMM 유지",
    keepBody: "WebR 챌린저가 현재 MMM의 시간순 WMAPE를 개선하지 못했습니다.",
    validate: "추가 검증 필요",
    validateBody: "개선 신호가 있더라도 비교 가능한 시간창이 2개 미만이거나 5% 문턱을 넘지 못해 교체하지 않습니다.",
    importance: "WebR 예측 중요도",
    caveat: "중요도는 |계수×표준편차|를 같은 채널의 adstock 후보끼리 합친 예측값입니다. 현재 MMM의 채널 기여율이나 인과효과가 아닙니다.",
  },
  en: {
    title: "WebR advanced validation · Elastic-net MMM challenger",
    desc: "R glmnet selects regularization inside time-ordered validation using a fixed, causal feature library built from raw channel spend, adstock candidates, trend, seasonality, and events. It compares predictive error on the current MMM's validation weeks without replacing contribution or causal interpretation.",
    run: "Run WebR MMM head-to-head",
    loading: "Evaluating R glmnet candidates across time-ordered folds…",
    blocked: (n, required) => `${n || 0} weeks are available. The WebR MMM challenger requires at least ${required || 78}.`,
    failed: "The WebR MMM comparison did not complete. The current MMM result is unchanged.",
    candidate: "Prediction-engine replacement candidate",
    candidateBody: (gain) => `WebR improved WMAPE by ${gain}% across the same multiple time windows. This applies only to the prediction path; keep current MMM contribution and budget decisions until separately validated.`,
    keep: "Keep the current JS MMM",
    keepBody: "The WebR challenger did not improve the current MMM's time-ordered WMAPE.",
    validate: "More validation required",
    validateBody: "Even with an improvement signal, the comparison has fewer than two comparable windows or does not clear the 5% threshold, so no engine is replaced.",
    importance: "WebR predictive importance",
    caveat: "Importance sums |coefficient × standard deviation| across adstock candidates for the same channel. It is not current MMM channel contribution or a causal effect.",
  },
};

export default function WebRMmmAdvanced({ mmm, signature, locale = "ko", source = "csv" }) {
  const T = COPY[locale] || COPY.ko;
  const requestRef = useRef(0);
  const [run, setRun] = useState({ status: "idle", signature: null, result: null });
  const input = useMemo(() => prepareMmmElasticNetInput({ panel: mmm?.panel, run: mmm?.run, target: mmm?.target }), [mmm]);

  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

  if (!mmm?.panel || !mmm?.run) return null;

  const execute = async () => {
    if (!input.ok) return;
    const requestId = ++requestRef.current;
    setRun({ status: "loading", signature, result: null });
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
      trackProductEvent("analysis_completed", {
        tool_id: "5-18", source, row_count: input.n, analysis_type: "webr_mmm_elastic_net", result_state: "failed", locale,
      });
    }
  };

  const visible = run.signature === signature ? run : { status: "idle", result: null };
  const result = visible.result;
  const verdict = result?.recommendation === "predictive_replacement_candidate"
    ? { title: T.candidate, body: T.candidateBody((result.relativeGain * 100).toFixed(1)), tone: "info" }
    : result?.recommendation === "keep_current_js"
      ? { title: T.keep, body: T.keepBody, tone: "warn" }
      : { title: T.validate, body: T.validateBody, tone: "info" };

  return (
    <section className="block" id="s-mmm-webr-challenger">
      <h2 className="section-title"><span className="ix">ADV</span>{T.title}</h2>
      <p className="muted" style={{ fontSize: "12px", margin: "0 0 12px", lineHeight: 1.55 }}>{T.desc}</p>
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
              <div className={`callout ${verdict.tone}`}><div className="body"><strong>{verdict.title}</strong><p>{verdict.body}</p></div></div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "10px 0" }}>
                <div className="stat-card"><div className="lbl">WebR elastic-net · WMAPE</div><div className="val">{result.wmape.toFixed(1)}%</div></div>
                <div className="stat-card"><div className="lbl">{locale === "en" ? "Current JS MMM · WMAPE" : "현재 JS MMM · WMAPE"}</div><div className="val">{Number.isFinite(result.baselineWmape) ? `${result.baselineWmape.toFixed(1)}%` : "—"}</div></div>
                <div className="stat-card"><div className="lbl">folds · horizon</div><div className="val">{result.folds} · {result.horizon}</div></div>
                <div className="stat-card"><div className="lbl">α · nonzero</div><div className="val">{result.alpha.toFixed(2)} · {result.nonzeroFeatures}</div></div>
              </div>
              <h3 className="section-title" style={{ fontSize: "13px" }}>{T.importance}</h3>
              <div className="table-wrap"><table className="data" style={{ fontSize: "12px" }}>
                <thead><tr><th style={{ textAlign: "left" }}>{locale === "en" ? "Driver" : "동인"}</th><th style={{ textAlign: "right" }}>importance</th></tr></thead>
                <tbody>{result.importance.slice(0, 10).map((row) => <tr key={`${row.kind}:${row.name}`}><td>{row.name}</td><td className="tnum" style={{ textAlign: "right" }}>{row.importance.toFixed(3)}</td></tr>)}</tbody>
              </table></div>
              <p className="muted" style={{ fontSize: "11px", marginTop: "8px" }}>{T.caveat}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

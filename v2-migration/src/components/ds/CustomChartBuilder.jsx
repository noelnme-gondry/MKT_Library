"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CHART_TYPES } from "@/utils/metrics/chartBuilder";

// ─────────────────────────────────────────────────────────────────────────────
// CustomChartBuilder — 커스텀 차트 조립 모달 (Phase C)
// ─────────────────────────────────────────────────────────────────────────────
// 유저가 "차트 모양 → 행(차원) → 값(지표)"을 골라 차트를 생성. 값 지표는 base·파생·
// 커스텀 지표 모두 선택 가능(커스텀 데이터 열도 사용). body portal(§7/PR#170).
//
// props: open, onClose, dims[{key,label}], metrics[{key,label}], existing[], onCreate(def), onDelete(id)
export default function CustomChartBuilder({
  open, onClose, dims = [], metrics = [], existing = [], onCreate, onDelete, locale = "ko",
}) {
  const isEn = locale === "en";
  const T = isEn ? {
    title: "Build a custom chart", close: "Close", noMetrics: "Map at least one calculable metric before building a chart.",
    intro: "Choose a chart shape, row dimension, and metric. Custom metrics can be used as values too.",
    shape: "1. Chart shape", row: "2. Row (dimension)", value: "2. Value (metric)", value3: "3. Value (metric)",
    name: "3. Chart name", name4: "4. Chart name", placeholder: "e.g. ROAS by channel", newChart: "New chart",
    create: "+ Create chart", mine: "My charts", delete: "Delete", cancel: "Cancel", saved: "🔒 Saved in this browser only",
  } : {
    title: "커스텀 차트 만들기", close: "닫기", noMetrics: "차트를 만들려면 계산 가능한 지표가 데이터에 있어야 합니다. CSV를 업로드·매핑하세요.",
    intro: "모양을 고르고, 행(차원)과 값(지표)을 선택하면 차트가 생성됩니다. 값에는 커스텀 지표도 쓸 수 있어요.",
    shape: "1. 차트 모양", row: "2. 행 (차원)", value: "2. 값 (지표)", value3: "3. 값 (지표)",
    name: "3. 차트 이름", name4: "4. 차트 이름", placeholder: "예: 채널별 ROAS", newChart: "새 차트",
    create: "+ 차트 생성", mine: "내가 만든 차트", delete: "삭제", cancel: "닫기", saved: "🔒 이 브라우저에만 저장",
  };
  const chartTypeLabel = (chartType) => {
    if (!isEn) return CHART_TYPES.find((t) => t.id === chartType)?.label;
    return { bar: "Bar", line: "Line", scorecard: "Scorecard" }[chartType] || chartType;
  };
  const [name, setName] = useState("");
  const [type, setType] = useState("bar");
  const [dim, setDim] = useState("");
  const [metric, setMetric] = useState("");

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(""); setType("bar");
    setDim(dims[0] ? dims[0].key : ""); setMetric(metrics[0] ? metrics[0].key : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const dimLabel = (k) => dims.find((d) => d.key === k)?.label || k;
  const metricLabel = (k) => metrics.find((m) => m.key === k)?.label || k;
  const isScorecard = type === "scorecard";
  const hasMetrics = metrics.length > 0;
  const canBuild = hasMetrics && (isScorecard || dims.length > 0);
  const valid = canBuild && name.trim() && (isScorecard || dim) && metric;
  const sel = { padding: "7px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", color: "var(--text-primary)", fontSize: "13px", width: "100%" };

  const create = () => {
    if (!valid) return;
    onCreate?.({ name: name.trim(), type, dim: isScorecard ? "" : dim, metric });
    setName("");
  };

  const modal = (
    <div
      role="dialog" aria-modal="true" aria-label={T.title}
      style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(500px, 94vw)", maxHeight: "88vh", overflow: "auto", background: "var(--surface-base, var(--bg-1))", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{T.title}</h3>
          <button className="ab-pill" onClick={onClose} aria-label={T.close} style={{ padding: "2px 8px" }}>✕</button>
        </div>

        {!hasMetrics ? (
          <p className="muted" style={{ fontSize: "12px" }}>{T.noMetrics}</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: "11px", margin: "0 0 14px" }}>
              {T.intro}
            </p>

            {/* 1) 차트 모양 */}
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "5px" }}>{T.shape}</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
              {CHART_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`ab-pill ${type === t.id ? "active" : ""}`}
                  style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: type === t.id ? 700 : 400 }}
                >
                  <span aria-hidden>{t.icon}</span> {chartTypeLabel(t.id)}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
              {!isScorecard && <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: "140px" }}>
                <span className="muted" style={{ fontSize: "10.5px" }}>{T.row}</span>
                <select value={dim} onChange={(e) => setDim(e.target.value)} style={sel}>
                  {dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>}
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: "140px" }}>
                <span className="muted" style={{ fontSize: "10.5px" }}>{isScorecard ? T.value : T.value3}</span>
                <select value={metric} onChange={(e) => setMetric(e.target.value)} style={sel}>
                  {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "14px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>{isScorecard ? T.name : T.name4}</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={T.placeholder} style={sel} />
            </label>

            <div style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", marginBottom: "12px", fontSize: "12px", color: "var(--text-primary)" }}>
              <strong>{name.trim() || T.newChart}</strong> — {chartTypeLabel(type)} · {isScorecard ? metricLabel(metric) : `${dimLabel(dim)} · ${metricLabel(metric)}`}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="ab-pill" onClick={onClose}>{T.cancel}</button>
              <button className={`ab-pill ${valid ? "active" : ""}`} onClick={create} disabled={!valid} style={{ fontWeight: 700, opacity: valid ? 1 : 0.5 }}>{T.create}</button>
            </div>
          </>
        )}

        {existing.length > 0 && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "6px" }}>{T.mine} ({existing.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {existing.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{c.name}</strong>
                    <span className="muted" style={{ marginLeft: "6px", fontSize: "11px" }}>{chartTypeLabel(c.type)} · {c.type === "scorecard" ? metricLabel(c.metric) : `${dimLabel(c.dim)} · ${metricLabel(c.metric)}`}</span>
                  </span>
                  <button className="ab-pill" onClick={() => onDelete?.(c.id)} title={T.delete} style={{ padding: "2px 8px" }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: "10px", marginTop: "12px", textAlign: "right" }}>{T.saved}</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

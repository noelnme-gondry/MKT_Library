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
  open, onClose, dims = [], metrics = [], existing = [], onCreate, onDelete,
}) {
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
  const canBuild = dims.length > 0 && metrics.length > 0;
  const valid = canBuild && name.trim() && dim && metric;
  const sel = { padding: "7px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", color: "var(--text-primary)", fontSize: "13px", width: "100%" };

  const create = () => {
    if (!valid) return;
    onCreate?.({ name: name.trim(), type, dim, metric });
    setName("");
  };

  const modal = (
    <div
      role="dialog" aria-modal="true" aria-label="커스텀 차트 만들기"
      style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(500px, 94vw)", maxHeight: "88vh", overflow: "auto", background: "var(--surface-base, var(--bg-1))", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>커스텀 차트 만들기</h3>
          <button className="ab-pill" onClick={onClose} aria-label="닫기" style={{ padding: "2px 8px" }}>✕</button>
        </div>

        {!canBuild ? (
          <p className="muted" style={{ fontSize: "12px" }}>차트를 만들려면 차원(채널·국가 등)과 지표가 데이터에 있어야 합니다. CSV를 업로드·매핑하세요.</p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: "11px", margin: "0 0 14px" }}>
              모양을 고르고, 행(차원)과 값(지표)을 선택하면 차트가 생성됩니다. 값에는 커스텀 지표도 쓸 수 있어요.
            </p>

            {/* 1) 차트 모양 */}
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "5px" }}>1. 차트 모양</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
              {CHART_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`ab-pill ${type === t.id ? "active" : ""}`}
                  style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: type === t.id ? 700 : 400 }}
                >
                  <span aria-hidden>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: "140px" }}>
                <span className="muted" style={{ fontSize: "10.5px" }}>2. 행 (차원)</span>
                <select value={dim} onChange={(e) => setDim(e.target.value)} style={sel}>
                  {dims.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: "140px" }}>
                <span className="muted" style={{ fontSize: "10.5px" }}>3. 값 (지표)</span>
                <select value={metric} onChange={(e) => setMetric(e.target.value)} style={sel}>
                  {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "14px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>4. 차트 이름</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 채널별 ROAS" style={sel} />
            </label>

            <div style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", marginBottom: "12px", fontSize: "12px", color: "var(--text-primary)" }}>
              <strong>{name.trim() || "새 차트"}</strong> — {CHART_TYPES.find((t) => t.id === type)?.label} · {dimLabel(dim)}별 {metricLabel(metric)}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="ab-pill" onClick={onClose}>닫기</button>
              <button className={`ab-pill ${valid ? "active" : ""}`} onClick={create} disabled={!valid} style={{ fontWeight: 700, opacity: valid ? 1 : 0.5 }}>+ 차트 생성</button>
            </div>
          </>
        )}

        {existing.length > 0 && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "6px" }}>내가 만든 차트 ({existing.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {existing.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{c.name}</strong>
                    <span className="muted" style={{ marginLeft: "6px", fontSize: "11px" }}>{CHART_TYPES.find((t) => t.id === c.type)?.label} · {dimLabel(c.dim)}별 {metricLabel(c.metric)}</span>
                  </span>
                  <button className="ab-pill" onClick={() => onDelete?.(c.id)} title="삭제" style={{ padding: "2px 8px" }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: "10px", marginTop: "12px", textAlign: "right" }}>🔒 이 브라우저에만 저장</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

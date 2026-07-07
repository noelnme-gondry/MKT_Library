"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CUSTOM_OPS, customMetricCompute, customMetricFormula, isValidCustomMetricDef,
} from "@/utils/metrics/customMetric";

// ─────────────────────────────────────────────────────────────────────────────
// CustomMetricBuilder — 커스텀 지표 조립 모달 (Phase C, 오타 없는 안전 빌더)
// ─────────────────────────────────────────────────────────────────────────────
// 유저는 "필드 A ∘ 필드 B"를 드롭다운으로만 조립(자유 텍스트 없음 → 오타·eval 원천 차단).
// 피연산자 dropdown = 실제 데이터에 매핑된 컬럼만(fields). 라벨 옆에 실제 CSV 헤더 표기.
// body portal(§7/PR#170). 생성/삭제는 이 모달에서, 표시/순서는 MetricConfigPanel에서.
//
// props:
//  open, onClose
//  fields    [{ key, label, header }] — 조립 가능한 필드(실제 매핑된 것만)
//  agg       집계객체 — 라이브 미리보기 계산용
//  existing  [{ id, name, op, a, b }] — 이미 만든 커스텀 지표(삭제용 목록)
//  onCreate(def)   { name, op, a, b } 생성
//  onDelete(id)    삭제
export default function CustomMetricBuilder({
  open, onClose, fields = [], agg = {}, existing = [], onCreate, onDelete,
}) {
  const [name, setName] = useState("");
  const [op, setOp] = useState("div");
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  // 열릴 때 폼 초기화(필드 있으면 기본 피연산자 세팅으로 바로 조립 가능하게).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(""); setOp("div");
    setA(fields[0] ? fields[0].key : ""); setB(fields[1] ? fields[1].key : (fields[0] ? fields[0].key : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const labelOf = (k) => (fields.find((f) => f.key === k)?.label) || k;
  const draft = { name: name.trim() || "새 지표", op, a, b };
  const valid = isValidCustomMetricDef({ name, op, a, b });
  const previewVal = valid ? customMetricCompute(draft)(agg) : null;
  const previewStr = previewVal == null
    ? "계산 불가 (분모 0 또는 데이터 없음)"
    : Number(previewVal).toLocaleString("ko-KR", { maximumFractionDigits: 4 });

  const create = () => {
    if (!valid) return;
    onCreate?.({ name: name.trim(), op, a, b });
    setName("");
  };

  const fieldSelect = (val, setter, label) => (
    <label style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: 0 }}>
      <span className="muted" style={{ fontSize: "10.5px" }}>{label}</span>
      <select
        value={val}
        onChange={(e) => setter(e.target.value)}
        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", color: "var(--text-primary)", fontSize: "13px" }}
      >
        {fields.length === 0 && <option value="">사용 가능한 컬럼 없음</option>}
        {fields.map((f) => (
          <option key={f.key} value={f.key}>{f.label}{f.header ? ` (${f.header})` : ""}</option>
        ))}
      </select>
    </label>
  );

  const modal = (
    <div
      role="dialog" aria-modal="true" aria-label="커스텀 지표 만들기"
      style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 94vw)", maxHeight: "85vh", overflow: "auto", background: "var(--surface-base, var(--bg-1))", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>커스텀 지표 만들기</h3>
          <button className="ab-pill" onClick={onClose} aria-label="닫기" style={{ padding: "2px 8px" }}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: "11px", margin: "0 0 14px" }}>
          데이터에 있는 컬럼을 골라 조립합니다(직접 입력 없음 → 오타 걱정 X). 예: 매출 ÷ 비용 = ROAS.
        </p>

        {fields.length < 1 ? (
          <p className="muted" style={{ fontSize: "12px" }}>조립할 수 있는 숫자 컬럼이 데이터에 없습니다. CSV를 먼저 업로드·매핑하세요.</p>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "10px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>지표 이름</span>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="예: 순이익, 효율지수…"
                style={{ padding: "7px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", color: "var(--text-primary)", fontSize: "13px" }}
              />
            </label>

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginBottom: "10px" }}>
              {fieldSelect(a, setA, "필드 A")}
              <label style={{ display: "flex", flexDirection: "column", gap: "3px", width: "110px" }}>
                <span className="muted" style={{ fontSize: "10.5px" }}>연산</span>
                <select
                  value={op} onChange={(e) => setOp(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", color: "var(--text-primary)", fontSize: "13px" }}
                >
                  {CUSTOM_OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              {fieldSelect(b, setB, "필드 B")}
            </div>

            <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                <strong>{name.trim() || "새 지표"}</strong> = {customMetricFormula(draft, labelOf)}
              </div>
              <div className="muted" style={{ fontSize: "11px", marginTop: "3px" }}>
                현재 데이터 미리보기: <span style={{ color: "var(--text-primary)" }}>{previewStr}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="ab-pill" onClick={onClose}>닫기</button>
              <button className={`ab-pill ${valid ? "active" : ""}`} onClick={create} disabled={!valid} style={{ fontWeight: 700, opacity: valid ? 1 : 0.5 }}>
                + 지표 추가
              </button>
            </div>
          </>
        )}

        {existing.length > 0 && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "6px" }}>내가 만든 지표 ({existing.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {existing.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{m.name}</strong>
                    <span className="muted" style={{ marginLeft: "6px", fontSize: "11px" }}>{customMetricFormula(m, labelOf)}</span>
                  </span>
                  <button className="ab-pill" onClick={() => onDelete?.(m.id)} title="삭제" style={{ padding: "2px 8px" }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: "10px", marginTop: "12px", textAlign: "right" }}>
          🔒 이 브라우저에만 저장 (데이터 서버 전송 없음)
        </p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

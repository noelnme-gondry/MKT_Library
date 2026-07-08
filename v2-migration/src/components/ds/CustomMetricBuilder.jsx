"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CUSTOM_OPS, customMetricCompute, customMetricFormula, isValidCustomMetricDef,
} from "@/utils/metrics/customMetric";

// ─────────────────────────────────────────────────────────────────────────────
// CustomMetricBuilder — 커스텀 지표 조립 모달 (Phase C, 오타 없는 안전 빌더)
// ─────────────────────────────────────────────────────────────────────────────
// 유저는 항(term)을 드롭다운/숫자입력으로만 조립(자유 텍스트 없음 → 오타·eval 차단).
// N항 좌→우 순차 계산: [필드/숫자] ∘ [필드/숫자] ∘ … (예: 비용 ÷ 노출수 × 1000).
// 피연산자 컬럼 dropdown = 실제 매핑된 것만. body portal(§7/PR#170).
//
// props: open, onClose, fields[{key,label,header}], agg, existing[], onCreate(def), onUpdate(id,def), onDelete(id)
export default function CustomMetricBuilder({
  open, onClose, fields = [], agg = {}, existing = [], onCreate, onUpdate, onDelete,
}) {
  const firstFieldKey = fields[0] ? fields[0].key : "";
  const [name, setName] = useState("");
  // terms[0]=첫 피연산자(op 없음), terms[i>0]={op, type, value}.
  const [terms, setTerms] = useState([{ type: "field", value: firstFieldKey }]);
  const [chartType, setChartType] = useState("bar"); // 일별 상세 차트 모양(막대/선)
  const [editingId, setEditingId] = useState(null); // null=신규, 아니면 수정 중

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setTerms([{ type: "field", value: fields[0] ? fields[0].key : "" }]);
    setChartType("bar");
  };

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingId(null);
    setName("");
    setTerms([{ type: "field", value: fields[0] ? fields[0].key : "" }]);
    setChartType("bar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 기존 지표를 폼으로 로드해 수정 시작(같은 화면에서 편집).
  const startEdit = (m) => {
    setEditingId(m.id);
    setName(m.name || "");
    setTerms((m.terms && m.terms.length) ? m.terms.map((t) => ({ ...t })) : [{ type: "field", value: fields[0] ? fields[0].key : "" }]);
    setChartType(m.chartType === "line" ? "line" : "bar");
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const labelOf = (k) => (fields.find((f) => f.key === k)?.label) || k;
  const def = { name: name.trim() || "새 지표", terms };
  const valid = isValidCustomMetricDef({ name, terms });
  const previewVal = valid ? customMetricCompute(def)(agg) : null;
  const previewStr = previewVal == null
    ? "계산 불가 (분모 0 또는 데이터 없음)"
    : Number(previewVal).toLocaleString("ko-KR", { maximumFractionDigits: 4 });

  const setTermAt = (i, next) => setTerms((ts) => ts.map((t, idx) => (idx === i ? next : t)));
  const addTerm = () => setTerms((ts) => [...ts, { op: "div", type: "field", value: fields[0] ? fields[0].key : "" }]);
  const removeTerm = (i) => setTerms((ts) => ts.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!valid) return;
    const def = { name: name.trim(), terms, chartType };
    if (editingId) onUpdate?.(editingId, def);
    else onCreate?.(def);
    resetForm();
  };

  const sel = { padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", color: "var(--text-primary)", fontSize: "13px" };

  // 항 하나의 피연산자 편집기 — 컬럼(드롭다운) 또는 숫자(입력) 토글.
  const operandEditor = (t, i) => {
    const isConst = t.type === "const";
    const onType = (type) => setTermAt(i, { ...t, type, value: type === "const" ? "" : (fields[0] ? fields[0].key : "") });
    return (
      <>
        <select value={t.type} onChange={(e) => onType(e.target.value)} style={{ ...sel, width: "72px", flex: "none" }} aria-label="종류">
          <option value="field">컬럼</option>
          <option value="const">숫자</option>
        </select>
        {isConst ? (
          <input
            type="text" inputMode="decimal" value={t.value}
            onChange={(e) => setTermAt(i, { ...t, value: e.target.value })}
            placeholder="숫자 (예: 1000)"
            style={{ ...sel, flex: 1, minWidth: 0 }} aria-label="숫자 값"
          />
        ) : (
          <select value={t.value} onChange={(e) => setTermAt(i, { ...t, value: e.target.value })} style={{ ...sel, flex: 1, minWidth: 0 }} aria-label="컬럼">
            {fields.length === 0 && <option value="">컬럼 없음</option>}
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.header ? ` (${f.header})` : ""}</option>)}
          </select>
        )}
      </>
    );
  };

  const modal = (
    <div
      role="dialog" aria-modal="true" aria-label="커스텀 지표 만들기"
      style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(520px, 94vw)", maxHeight: "88vh", overflow: "auto", background: "var(--surface-base, var(--bg-1))", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>커스텀 지표 만들기</h3>
          <button className="ab-pill" onClick={onClose} aria-label="닫기" style={{ padding: "2px 8px" }}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: "11px", margin: "0 0 14px" }}>
          컬럼·숫자를 골라 항을 이어 붙입니다(직접 입력 없음 → 오타 X). 왼쪽부터 순서대로 계산돼요(예: 비용 ÷ 노출수 × 1000 = eCPM).
        </p>

        {fields.length < 1 ? (
          <p className="muted" style={{ fontSize: "12px" }}>조립할 수 있는 숫자 컬럼이 데이터에 없습니다. CSV를 먼저 업로드·매핑하세요.</p>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "12px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>지표 이름</span>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="예: 순이익, eCPM, 효율지수…"
                style={{ ...sel, padding: "7px 9px" }}
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              {/* 첫 항 (연산자 없음) */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span className="muted" style={{ fontSize: "11px", width: "34px", flex: "none" }}>시작</span>
                {operandEditor(terms[0], 0)}
                <span style={{ width: "26px", flex: "none" }} />
              </div>
              {/* 이후 항 (연산자 + 피연산자 + 삭제) */}
              {terms.slice(1).map((t, idx) => {
                const i = idx + 1;
                return (
                  <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <select value={t.op} onChange={(e) => setTermAt(i, { ...t, op: e.target.value })} style={{ ...sel, width: "34px", flex: "none", padding: "6px 2px", textAlign: "center" }} aria-label="연산">
                      {CUSTOM_OPS.map((o) => <option key={o.id} value={o.id}>{o.sym}</option>)}
                    </select>
                    {operandEditor(t, i)}
                    <button className="ab-pill" onClick={() => removeTerm(i)} title="이 항 삭제" style={{ padding: "2px 7px", width: "26px", flex: "none" }}>✕</button>
                  </div>
                );
              })}
              <button className="ab-pill" onClick={addTerm} style={{ alignSelf: "flex-start" }}>＋ 항 추가</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "14px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>일별 상세 차트 모양</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button type="button" onClick={() => setChartType("bar")} className={`ab-pill ${chartType === "bar" ? "active" : ""}`} style={{ fontWeight: chartType === "bar" ? 700 : 400 }}>📊 막대</button>
                <button type="button" onClick={() => setChartType("line")} className={`ab-pill ${chartType === "line" ? "active" : ""}`} style={{ fontWeight: chartType === "line" ? 700 : 400 }}>📈 선</button>
              </div>
            </div>

            <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-primary)", wordBreak: "break-word" }}>
                <strong>{name.trim() || "새 지표"}</strong> = {customMetricFormula(def, labelOf)}
              </div>
              <div className="muted" style={{ fontSize: "11px", marginTop: "3px" }}>
                현재 데이터 미리보기: <span style={{ color: "var(--text-primary)" }}>{previewStr}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
              {editingId && <span className="muted" style={{ fontSize: "11px", marginRight: "auto" }}>수정 중…</span>}
              {editingId && <button className="ab-pill" onClick={resetForm}>취소</button>}
              {!editingId && <button className="ab-pill" onClick={onClose}>닫기</button>}
              <button className={`ab-pill ${valid ? "active" : ""}`} onClick={submit} disabled={!valid} style={{ fontWeight: 700, opacity: valid ? 1 : 0.5 }}>
                {editingId ? "수정 저장" : "+ 지표 추가"}
              </button>
            </div>
          </>
        )}

        {existing.length > 0 && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "6px" }}>내가 만든 지표 ({existing.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {existing.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", borderRadius: "6px", border: `1px solid ${editingId === m.id ? "var(--primary, #4c8dff)" : "var(--border)"}` }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{m.name}</strong>
                    <span className="muted" style={{ marginLeft: "6px", fontSize: "11px" }}>{customMetricFormula(m, labelOf)}</span>
                  </span>
                  <button className="ab-pill" onClick={() => startEdit(m)} title="수정" style={{ padding: "2px 8px" }}>✏️</button>
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

"use client";
import React, { useEffect, useState } from "react";
import ModalDialog from "@/components/ds/ModalDialog";
import {
  CUSTOM_OPS, customMetricCompute, customMetricFormula, isValidCustomMetricDef,
} from "@/utils/metrics/customMetric";

const ICON_TOUCH_TARGET = {
  boxSizing: "border-box",
  minWidth: "44px",
  minHeight: "44px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};

// ─────────────────────────────────────────────────────────────────────────────
// CustomMetricBuilder — 커스텀 지표 조립 모달 (Phase C, 오타 없는 안전 빌더)
// ─────────────────────────────────────────────────────────────────────────────
// 유저는 항(term)을 드롭다운/숫자입력으로만 조립(자유 텍스트 없음 → 오타·eval 차단).
// N항 좌→우 순차 계산: [필드/숫자] ∘ [필드/숫자] ∘ … (예: 비용 ÷ 노출수 × 1000).
// 피연산자 컬럼 dropdown = 실제 매핑된 것만. body portal(§7/PR#170).
//
// props: open, onClose, fields[{key,label,header}], agg, existing[], onCreate(def), onUpdate(id,def), onDelete(id)
export default function CustomMetricBuilder({
  open, onClose, fields = [], agg = {}, existing = [], onCreate, onUpdate, onDelete, locale = "ko",
}) {
  const isEn = locale === "en";
  const T = isEn ? {
    title: "Build a custom metric", close: "Close", type: "Type", field: "Field", number: "Number", operator: "Operator",
    numberPlaceholder: "Number (e.g. 1000)", noFields: "No numeric columns are available. Upload and map a CSV first.",
    intro: "Join fields and numbers into a formula (no free text → fewer typos). Terms are calculated left to right (e.g. cost ÷ impressions × 1000 = eCPM).",
    name: "Metric name", namePlaceholder: "e.g. Net profit, eCPM, efficiency index…", start: "Start",
    noColumn: "No column", addTerm: "＋ Add term", chartShape: "Daily detail chart shape", bar: "Bars", line: "Line",
    preview: "Current data preview", editing: "Editing…", cancel: "Cancel", save: "Save changes", add: "+ Add metric",
    mine: "My metrics", edit: "Edit", delete: "Delete", deleteTerm: "Delete this term", shown: "Saved in this browser only (data is not sent to a server)",
    newMetric: "New metric", cannotCompute: "Cannot compute (zero denominator or no data)",
  } : {
    title: "커스텀 지표 만들기", close: "닫기", type: "종류", field: "컬럼", number: "숫자", operator: "연산",
    numberPlaceholder: "숫자 (예: 1000)", noFields: "조립할 수 있는 숫자 컬럼이 데이터에 없습니다. CSV를 먼저 업로드·매핑하세요.",
    intro: "컬럼·숫자를 골라 항을 이어 붙입니다(직접 입력 없음 → 오타 X). 왼쪽부터 순서대로 계산돼요(예: 비용 ÷ 노출수 × 1000 = eCPM).",
    name: "지표 이름", namePlaceholder: "예: 순이익, eCPM, 효율지수…", start: "시작",
    noColumn: "컬럼 없음", addTerm: "＋ 항 추가", chartShape: "일별 상세 차트 모양", bar: "📊 막대", line: "📈 선",
    preview: "현재 데이터 미리보기", editing: "수정 중…", cancel: "취소", save: "수정 저장", add: "+ 지표 추가",
    mine: "내가 만든 지표", edit: "수정", delete: "삭제", deleteTerm: "이 항 삭제", shown: "🔒 이 브라우저에만 저장 (데이터 서버 전송 없음)",
    newMetric: "새 지표", cannotCompute: "계산 불가 (분모 0 또는 데이터 없음)",
  };
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

  if (!open || typeof document === "undefined") return null;

  const labelOf = (k) => (fields.find((f) => f.key === k)?.label) || k;
  const def = { name: name.trim() || "새 지표", terms };
  const valid = isValidCustomMetricDef({ name, terms });
  const previewVal = valid ? customMetricCompute(def)(agg) : null;
  const previewStr = previewVal == null
    ? T.cannotCompute
    : Number(previewVal).toLocaleString(isEn ? "en-US" : "ko-KR", { maximumFractionDigits: 4 });

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
        <select value={t.type} onChange={(e) => onType(e.target.value)} style={{ ...sel, width: "72px", flex: "none" }} aria-label={T.type}>
          <option value="field">{T.field}</option>
          <option value="const">{T.number}</option>
        </select>
        {isConst ? (
          <input
            type="text" inputMode="decimal" value={t.value}
            onChange={(e) => setTermAt(i, { ...t, value: e.target.value })}
            placeholder={T.numberPlaceholder}
            style={{ ...sel, flex: 1, minWidth: 0 }} aria-label={T.number}
          />
        ) : (
          <select value={t.value} onChange={(e) => setTermAt(i, { ...t, value: e.target.value })} style={{ ...sel, flex: 1, minWidth: 0 }} aria-label={T.field}>
            {fields.length === 0 && <option value="">{T.noColumn}</option>}
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.header ? ` (${f.header})` : ""}</option>)}
          </select>
        )}
      </>
    );
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      ariaLabel={T.title}
      overlayStyle={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      panelStyle={{ boxSizing: "border-box", width: "min(520px, 94vw)", maxHeight: "88vh", overflow: "auto", background: "var(--surface-base, var(--bg-1))", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
    >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{T.title}</h3>
          <button type="button" className="ab-pill" onClick={onClose} aria-label={`${T.title}: ${T.close}`} style={{ ...ICON_TOUCH_TARGET, padding: "2px 8px" }}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: "11px", margin: "0 0 14px" }}>
          {T.intro}
        </p>

        {fields.length < 1 ? (
          <p className="muted" style={{ fontSize: "12px" }}>{T.noFields}</p>
        ) : (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "12px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>{T.name}</span>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={T.namePlaceholder}
                style={{ ...sel, padding: "7px 9px" }}
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              {/* 첫 항 (연산자 없음) */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span className="muted" style={{ fontSize: "11px", width: "34px", flex: "none" }}>{T.start}</span>
                {operandEditor(terms[0], 0)}
                <span style={{ width: "26px", flex: "none" }} />
              </div>
              {/* 이후 항 (연산자 + 피연산자 + 삭제) */}
              {terms.slice(1).map((t, idx) => {
                const i = idx + 1;
                return (
                  <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <select value={t.op} onChange={(e) => setTermAt(i, { ...t, op: e.target.value })} style={{ ...sel, width: "34px", flex: "none", padding: "6px 2px", textAlign: "center" }} aria-label={T.operator}>
                      {CUSTOM_OPS.map((o) => <option key={o.id} value={o.id}>{o.sym}</option>)}
                    </select>
                    {operandEditor(t, i)}
                    <button type="button" className="ab-pill" onClick={() => removeTerm(i)} title={T.deleteTerm} aria-label={`${T.deleteTerm} ${i + 1}`} style={{ ...ICON_TOUCH_TARGET, padding: "2px 7px" }}>✕</button>
                  </div>
                );
              })}
              <button className="ab-pill" onClick={addTerm} style={{ alignSelf: "flex-start" }}>{T.addTerm}</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "14px" }}>
              <span className="muted" style={{ fontSize: "10.5px" }}>{T.chartShape}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button type="button" onClick={() => setChartType("bar")} className={`ab-pill ${chartType === "bar" ? "active" : ""}`} style={{ fontWeight: chartType === "bar" ? 700 : 400 }}>{T.bar}</button>
                <button type="button" onClick={() => setChartType("line")} className={`ab-pill ${chartType === "line" ? "active" : ""}`} style={{ fontWeight: chartType === "line" ? 700 : 400 }}>{T.line}</button>
              </div>
            </div>

            <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-2, transparent)", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-primary)", wordBreak: "break-word" }}>
                <strong>{name.trim() || T.newMetric}</strong> = {customMetricFormula(def, labelOf)}
              </div>
              <div className="muted" style={{ fontSize: "11px", marginTop: "3px" }}>
                {T.preview}: <span style={{ color: "var(--text-primary)" }}>{previewStr}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
              {editingId && <span className="muted" style={{ fontSize: "11px", marginRight: "auto" }}>{T.editing}</span>}
              {editingId && <button className="ab-pill" onClick={resetForm}>{T.cancel}</button>}
              {!editingId && <button className="ab-pill" onClick={onClose}>{T.close}</button>}
              <button className={`ab-pill ${valid ? "active" : ""}`} onClick={submit} disabled={!valid} style={{ fontWeight: 700, opacity: valid ? 1 : 0.5 }}>
                {editingId ? T.save : T.add}
              </button>
            </div>
          </>
        )}

        {existing.length > 0 && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div className="muted" style={{ fontSize: "10.5px", marginBottom: "6px" }}>{T.mine} ({existing.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {existing.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px", borderRadius: "6px", border: `1px solid ${editingId === m.id ? "var(--primary, #4c8dff)" : "var(--border)"}` }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <strong>{m.name}</strong>
                    <span className="muted" style={{ marginLeft: "6px", fontSize: "11px" }}>{customMetricFormula(m, labelOf)}</span>
                  </span>
                  <button type="button" className="ab-pill" onClick={() => startEdit(m)} title={T.edit} aria-label={`${T.edit}: ${m.name}`} style={{ ...ICON_TOUCH_TARGET, padding: "2px 8px" }}>✏️</button>
                  <button type="button" className="ab-pill" onClick={() => onDelete?.(m.id)} title={T.delete} aria-label={`${T.delete}: ${m.name}`} style={{ ...ICON_TOUCH_TARGET, padding: "2px 8px" }}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ fontSize: "10px", marginTop: "12px", textAlign: "right" }}>
          {T.shown}
        </p>
    </ModalDialog>
  );
}

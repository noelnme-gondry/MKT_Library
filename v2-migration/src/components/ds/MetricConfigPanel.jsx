"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { materializeOrder } from "@/utils/metrics/metricView";

// ─────────────────────────────────────────────────────────────────────────────
// MetricConfigPanel — 지표/차트/컬럼 표시·순서 편집기 (Phase B/C, DnD + on/off 태그)
// ─────────────────────────────────────────────────────────────────────────────
// UX(사용자 중심):
//  · 각 항목에 표시/숨김 태그. 태그를 끄면 회색으로 바뀌고 "숨긴 항목" 구역(맨 뒤)로 이동.
//  · 표시 항목은 드래그앤드롭으로 순서 변경. 숨긴 항목은 회색·비드래그(태그로 되켜기).
//  · "적용"을 눌러야 반영·저장(취소/닫기=폐기). 반영 후 숨긴 건 아예 안 보임(레이아웃
//    밀림 없음 — 밀리는 건 편집 중 모달 안에서만, 실제 화면엔 on만 렌더).
// body portal(§7/PR#170). 상태는 부모(store viewConfig) 소유 — 적용 시 onSave 1회 emit.
//
// props: open, onClose, title, items[{key,label,desc?}], config{hidden,order}, onSave(next)
export default function MetricConfigPanel({
  open, onClose, title = "편집", items = [], config, onSave,
}) {
  const [draft, setDraft] = useState({ hidden: [], order: [] });
  const [dragKey, setDragKey] = useState(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      hidden: [...((config && config.hidden) || [])],
      order: [...((config && config.order) || [])],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const keys = items.map((it) => it.key);
  const byKey = new Map(items.map((it) => [it.key, it]));
  const hidden = new Set(draft.hidden || []);
  const fullOrder = materializeOrder(keys, draft.order || []);
  const onKeys = fullOrder.filter((k) => !hidden.has(k));
  const offKeys = fullOrder.filter((k) => hidden.has(k));

  // order를 항상 [표시…, 숨김…]으로 정규화해 저장(숨긴 건 뒤로).
  const commitOrder = (nextOn, nextHidden) => {
    const hid = new Set(nextHidden);
    const nextOff = fullOrder.filter((k) => hid.has(k) && !nextOn.includes(k));
    setDraft({ hidden: Array.from(hid), order: [...nextOn, ...nextOff] });
  };

  const toggle = (key) => {
    const nextHidden = new Set(hidden);
    if (nextHidden.has(key)) nextHidden.delete(key);
    else nextHidden.add(key);
    const nextOn = fullOrder.filter((k) => !nextHidden.has(k));
    commitOrder(nextOn, nextHidden);
  };

  // DnD: 드래그 중 항목을 대상 위치로 실시간 재배치(표시 항목끼리만).
  const onDragOver = (e, overKey) => {
    e.preventDefault();
    if (!dragKey || dragKey === overKey || hidden.has(overKey)) return;
    const from = onKeys.indexOf(dragKey);
    const to = onKeys.indexOf(overKey);
    if (from < 0 || to < 0) return;
    const next = onKeys.slice();
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    commitOrder(next, hidden);
  };

  const resetDraft = () => { setDraft({ hidden: [], order: [] }); };
  const apply = () => { onSave?.({ hidden: draft.hidden || [], order: draft.order || [] }); };

  const rowBase = {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)",
  };
  const tagBtn = (on) => ({
    padding: "2px 9px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
    border: `1px solid ${on ? "var(--primary, #4c8dff)" : "var(--border)"}`,
    background: on ? "var(--primary, #4c8dff)" : "transparent",
    color: on ? "#fff" : "var(--text-muted)", cursor: "pointer", flex: "none",
  });

  const modal = (
    <div
      role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(460px, 93vw)", maxHeight: "84vh", display: "flex", flexDirection: "column", background: "var(--surface-base, var(--bg-1))", border: "1px solid var(--border)", borderRadius: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 2px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
          <button className="ab-pill" onClick={onClose} aria-label="닫기" style={{ padding: "2px 8px" }}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: "11px", margin: "0 18px 10px" }}>
          태그를 눌러 표시/숨김 · 드래그(⠿)로 순서 변경 · <strong>적용</strong>을 눌러야 반영됩니다.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "0 18px", overflow: "auto" }}>
          {onKeys.map((key) => {
            const it = byKey.get(key);
            if (!it) return null;
            const isDragging = dragKey === key;
            return (
              <div
                key={key}
                draggable
                onDragStart={() => setDragKey(key)}
                onDragOver={(e) => onDragOver(e, key)}
                onDragEnd={() => setDragKey(null)}
                onDrop={() => setDragKey(null)}
                style={{ ...rowBase, background: "var(--bg-2, transparent)", opacity: isDragging ? 0.5 : 1, cursor: "grab" }}
              >
                <span aria-hidden style={{ color: "var(--text-muted)", cursor: "grab", fontSize: "14px", lineHeight: 1, flex: "none" }}>⠿</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.label}
                  {it.desc ? <span className="muted" style={{ fontSize: "11px", marginLeft: "6px" }}>{it.desc}</span> : null}
                </span>
                <button style={tagBtn(true)} onClick={() => toggle(key)} title="표시 중 — 누르면 숨김">표시</button>
              </div>
            );
          })}

          {offKeys.length > 0 && (
            <div className="muted" style={{ fontSize: "10.5px", margin: "8px 2px 2px" }}>숨긴 항목 ({offKeys.length}) — 태그를 눌러 다시 표시</div>
          )}
          {offKeys.map((key) => {
            const it = byKey.get(key);
            if (!it) return null;
            return (
              <div key={key} style={{ ...rowBase, background: "transparent", opacity: 0.5 }}>
                <span aria-hidden style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1, flex: "none" }}>⠿</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: "13px", color: "var(--text-muted)", textDecoration: "line-through", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.label}
                </span>
                <button style={tagBtn(false)} onClick={() => toggle(key)} title="숨김 — 누르면 표시">숨김</button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 18px", borderTop: "1px solid var(--border)", marginTop: "12px" }}>
          <button className="ab-pill" onClick={resetDraft}>전체 표시·기본 순서</button>
          <span className="muted" style={{ fontSize: "10px", flex: 1, lineHeight: 1.3 }}>🔒 이 브라우저에만 저장</span>
          <button className="ab-pill" onClick={onClose}>취소</button>
          <button className="ab-pill active" onClick={apply} style={{ fontWeight: 700 }}>적용</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

"use client";
import React, { useRef, useState } from "react";
import { materializeOrder, applyMetricView } from "@/utils/metrics/metricView";

// ─────────────────────────────────────────────────────────────────────────────
// InlineCardEditor — 그 화면 그대로(인라인) 카드 편집 (드래그·on/off·크기)
// ─────────────────────────────────────────────────────────────────────────────
// "편집"을 켜면 모달이 아니라 실제 카드 그리드 위에서 바로 편집:
//  · 각 카드 좌상단 드래그 손잡이(⠿, 마우스+터치)로 순서 변경.
//  · 우상단 표시/숨김 토글(끄면 회색). 크기(⤢) 토글로 2칸 넓게.
//  · 변경은 즉시 store viewConfig에 반영(persist) — WYSIWYG. 편집 끄면 숨김은 사라짐.
// config 스키마: { hidden:[], order:[], sizes:{key:"wide"} } (sizes는 이 컴포넌트 확장).
//
// props:
//  items[{key,label,node}]  후보 카드(node=카드 엘리먼트)
//  config                   viewConfig[scope]
//  editMode                 편집 on/off
//  onPatch(partial)         설정 부분 갱신(부모가 setViewConfig 머지)
//  gridClassName            "kpi-grid" | "ab-stat-row" 등
//  supportsResize           크기 토글 노출(기본 true)
export default function InlineCardEditor({
  items = [], config, editMode = false, onPatch, gridClassName = "", supportsResize = true,
}) {
  const [dragKey, setDragKey] = useState(null);
  const dragKeyRef = useRef(null);
  const cellRefs = useRef({});

  const keys = items.map((it) => it.key);
  const byKey = new Map(items.map((it) => [it.key, it]));
  const hidden = new Set((config && config.hidden) || []);
  const order = (config && config.order) || [];
  const sizes = (config && config.sizes) || {};

  // 편집 중엔 전부(숨김 포함) 표시, 평시엔 표시분만.
  const displayKeys = editMode
    ? materializeOrder(keys, order)
    : applyMetricView(items, config).map((it) => it.key);

  const patchHidden = (key) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key); else next.add(key);
    onPatch?.({ hidden: Array.from(next) });
  };
  const patchSize = (key) => {
    const next = { ...sizes };
    if (next[key] === "wide") delete next[key]; else next[key] = "wide";
    onPatch?.({ sizes: next });
  };
  const reorder = (fromKey, overKey) => {
    if (!fromKey || fromKey === overKey) return;
    const full = materializeOrder(keys, order);
    const fromI = full.indexOf(fromKey);
    const toI = full.indexOf(overKey);
    if (fromI < 0 || toI < 0 || fromI === toI) return;
    const next = full.slice();
    next.splice(fromI, 1);
    next.splice(toI, 0, fromKey);
    onPatch?.({ order: next });
  };

  // 포인터 DnD(마우스+터치) — 손잡이에서 시작, 포인터 좌표 아래 카드로 재배치.
  const keyAtPoint = (x, y) => {
    for (const key of displayKeys) {
      const el = cellRefs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  };
  const onHandleDown = (e, key) => {
    dragKeyRef.current = key;
    setDragKey(key);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onHandleMove = (e) => {
    if (!dragKeyRef.current) return;
    e.preventDefault();
    const over = keyAtPoint(e.clientX, e.clientY);
    if (over && over !== dragKeyRef.current) reorder(dragKeyRef.current, over);
  };
  const onHandleUp = (e) => {
    dragKeyRef.current = null;
    setDragKey(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const ctlBtn = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: "22px", height: "22px", borderRadius: "6px", fontSize: "12px",
    border: "1px solid var(--border)", background: "var(--surface-base, var(--bg-1))",
    color: "var(--text-muted)", cursor: "pointer", lineHeight: 1, padding: 0,
  };

  return (
    <div className={gridClassName}>
      {displayKeys.map((key) => {
        const it = byKey.get(key);
        if (!it) return null;
        const isHidden = hidden.has(key);
        const wide = sizes[key] === "wide";
        const isDragging = dragKey === key;
        return (
          <div
            key={key}
            ref={(el) => { cellRefs.current[key] = el; }}
            style={{
              position: "relative",
              gridColumn: wide ? "span 2" : undefined,
              opacity: editMode && isHidden ? 0.4 : 1,
              outline: isDragging ? "2px dashed var(--primary, #4c8dff)" : "none",
              outlineOffset: "2px",
              borderRadius: "var(--radius-xl, 12px)",
              transition: "opacity .12s",
            }}
          >
            {editMode && (
              <>
                {/* 드래그 손잡이(좌상단) */}
                <span
                  aria-hidden
                  onPointerDown={(e) => onHandleDown(e, key)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                  title="드래그해서 이동"
                  style={{ ...ctlBtn, position: "absolute", top: "4px", left: "4px", zIndex: 3, cursor: "grab", touchAction: "none", userSelect: "none" }}
                >⠿</span>
                {/* 표시/숨김 + 크기(우상단) */}
                <div style={{ position: "absolute", top: "4px", right: "4px", zIndex: 3, display: "flex", gap: "4px" }}>
                  {supportsResize && (
                    <button style={{ ...ctlBtn, ...(wide ? { color: "var(--primary,#4c8dff)", borderColor: "var(--primary,#4c8dff)" } : {}) }} onClick={() => patchSize(key)} title={wide ? "기본 크기" : "넓게(2칸)"}>⤢</button>
                  )}
                  <button
                    style={{ ...ctlBtn, ...(isHidden ? {} : { color: "#fff", background: "var(--primary,#4c8dff)", borderColor: "var(--primary,#4c8dff)" }) }}
                    onClick={() => patchHidden(key)}
                    title={isHidden ? "숨김 — 누르면 표시" : "표시 — 누르면 숨김"}
                  >{isHidden ? "🚫" : "👁"}</button>
                </div>
              </>
            )}
            {/* 편집 중엔 카드 자체 클릭(차트 선택 등) 차단 */}
            <div style={{ pointerEvents: editMode ? "none" : "auto" }}>{it.node}</div>
          </div>
        );
      })}
    </div>
  );
}

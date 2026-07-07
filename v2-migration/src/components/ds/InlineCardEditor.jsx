"use client";
import React, { useEffect, useRef, useState } from "react";
import { materializeOrder, applyMetricView } from "@/utils/metrics/metricView";

// ─────────────────────────────────────────────────────────────────────────────
// InlineCardEditor — 그 화면 그대로(인라인) 카드 편집 (드래그·on/off)
// ─────────────────────────────────────────────────────────────────────────────
// "편집"을 켜면 실제 카드 그리드 위에서 바로 편집:
//  · 좌상단 손잡이(⠿)로 드래그 → 포인터 최근접 카드 기준 "연속 재배치"(경계 안 넘어도
//    가까워지면 바로 자리 바꿈, 드래그 카드가 슬롯에 끼어드는 sortable 느낌).
//  · 우상단 눈 아이콘으로 표시/숨김(색 튐 없이 아이콘만, 꺼지면 흐려짐).
//  · 변경은 즉시 store viewConfig에 반영(persist)·WYSIWYG.
// 드래그 해소는 window 전역 pointerup/cancel/blur로 보장(핸들 놓쳐도 안 걸림).
// (사이즈 리사이즈는 추후 — sizes span 렌더는 유지해 이후 확장 대비.)
//
// props: items[{key,label,node}], config, editMode, onPatch(partial), gridClassName
export default function InlineCardEditor({
  items = [], config, editMode = false, onPatch, gridClassName = "",
}) {
  const [dragKey, setDragKey] = useState(null);
  const dragKeyRef = useRef(null);
  const cellRefs = useRef({});
  const latest = useRef({});

  const keys = items.map((it) => it.key);
  const byKey = new Map(items.map((it) => [it.key, it]));
  const hidden = new Set((config && config.hidden) || []);
  const order = (config && config.order) || [];
  const sizes = (config && config.sizes) || {};

  // 편집 중엔 전부(숨김 포함) 표시, 평시엔 표시분만.
  const displayKeys = editMode
    ? materializeOrder(keys, order)
    : applyMetricView(items, config).map((it) => it.key);

  // 스테일 클로저 방지 — 최신 값을 ref로 노출(window 핸들러가 읽음). 렌더 중 ref
  // 쓰기 대신 커밋 후 effect로 갱신(pointer 이벤트는 커밋 뒤라 최신값 참조).
  useEffect(() => {
    latest.current = { keys, order, displayKeys, onPatch };
  });

  const patchHidden = (key) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key); else next.add(key);
    onPatch?.({ hidden: Array.from(next) });
  };

  // 포인터 최근접(중점 거리) 카드 키 — containment 대신 연속 판정.
  const nearestKey = (x, y) => {
    let best = null;
    let bestD = Infinity;
    for (const key of latest.current.displayKeys) {
      const el = cellRefs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = key; }
    }
    return best;
  };

  const onWinMove = (e) => {
    const dk = dragKeyRef.current;
    if (!dk) return;
    e.preventDefault();
    const over = nearestKey(e.clientX, e.clientY);
    if (!over || over === dk) return;
    const { keys: ks, order: od, onPatch: patch } = latest.current;
    const full = materializeOrder(ks, od);
    const fromI = full.indexOf(dk);
    const toI = full.indexOf(over);
    if (fromI < 0 || toI < 0 || fromI === toI) return;
    const next = full.slice();
    next.splice(fromI, 1);
    next.splice(toI, 0, dk);
    patch?.({ order: next });
  };

  // 드래그 중 window 전역 리스너 — 이동(재배치) + 해소(항상 풀림).
  useEffect(() => {
    if (!dragKey) return undefined;
    const end = () => { dragKeyRef.current = null; setDragKey(null); };
    window.addEventListener("pointermove", onWinMove, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
    // onWinMove는 latest.current로 최신값 읽으므로 dragKey만 의존.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragKey]);

  const onHandleDown = (e, key) => {
    e.preventDefault();
    dragKeyRef.current = key;
    setDragKey(key);
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
              boxShadow: isDragging ? "0 6px 18px rgba(0,0,0,0.28)" : "none",
              transition: isDragging ? "none" : "opacity .12s",
            }}
          >
            {editMode && (
              <>
                <span
                  aria-hidden
                  onPointerDown={(e) => onHandleDown(e, key)}
                  title="드래그해서 이동"
                  style={{ ...ctlBtn, position: "absolute", top: "4px", left: "4px", zIndex: 3, cursor: "grab", touchAction: "none", userSelect: "none" }}
                >⠿</span>
                <button
                  onClick={() => patchHidden(key)}
                  title={isHidden ? "숨김 — 누르면 표시" : "표시 — 누르면 숨김"}
                  style={{ ...ctlBtn, position: "absolute", top: "4px", right: "4px", zIndex: 3, opacity: isHidden ? 0.4 : 1 }}
                >👁</button>
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

"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { materializeOrder, moveInOrder } from "@/utils/metrics/metricView";

// ─────────────────────────────────────────────────────────────────────────────
// MetricConfigPanel — 지표/차트 표시·순서 편집 드로어 (Phase B, 디자인시스템 공용)
// ─────────────────────────────────────────────────────────────────────────────
// 어느 도구/표면에서든 재사용: 후보 항목(items)을 받아 표시 토글 + ↑/↓ 순서 조정.
// ★ 편집은 로컬 draft에 쌓이고, "저장"을 눌러야 반영·저장된다(취소/닫기=폐기).
//   상태는 부모(store viewConfig)가 소유 — 저장 시 onSave(draft) 1회 emit.
// body portal(§7/PR#170): sticky 글래스바(backdrop-filter) 조상 안에서 position:fixed가
// viewport 기준을 잃는 트랩 회피 위해 document.body로 portal.
//
// props:
//  open, onClose
//  title        패널 제목(기본 "지표 편집")
//  items        [{ key, label, desc? }] — 도구가 availability 게이팅 끝낸 후보
//  config       { hidden:[], order:[] } (store viewConfig[scopeId]) — draft 초기값
//  onSave(next) "저장" 클릭 시 { hidden, order } emit(부모가 setViewConfig/reset 처리)
export default function MetricConfigPanel({
  open, onClose, title = "지표 편집", items = [], config, onSave,
}) {
  // 로컬 draft — 열릴 때 현재 config로 시드. 편집은 여기 쌓이고 저장 시에만 emit.
  const [draft, setDraft] = useState({ hidden: [], order: [] });
  useEffect(() => {
    if (!open) return;
    // 열릴 때 1회 현재 config로 시드(외부 상태→로컬 draft 동기화). config는 저장 시
    // (=닫힘)에만 바뀌므로 open 트리거만으로 충분, 편집 중 재시드 방지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      hidden: [...((config && config.hidden) || [])],
      order: [...((config && config.order) || [])],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // esc = 닫기(폐기)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const keys = items.map((it) => it.key);
  const hidden = new Set(draft.hidden || []);
  const eff = materializeOrder(keys, draft.order || []); // 표시 순서
  const byKey = new Map(items.map((it) => [it.key, it]));
  const visibleCount = keys.filter((k) => !hidden.has(k)).length;
  const dirty =
    JSON.stringify({ h: [...(config?.hidden || [])].sort(), o: config?.order || [] }) !==
    JSON.stringify({ h: [...(draft.hidden || [])].sort(), o: draft.order || [] });

  const toggle = (key) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft((d) => ({ ...d, hidden: Array.from(next) }));
  };
  const move = (key, dir) => {
    setDraft((d) => ({ ...d, order: moveInOrder(keys, d.order || [], key, dir) }));
  };
  const resetDraft = () => setDraft({ hidden: [], order: [] });
  const save = () => { onSave?.({ hidden: draft.hidden || [], order: draft.order || [] }); };

  const panel = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0, zIndex: 3000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 92vw)", maxHeight: "82vh", display: "flex", flexDirection: "column",
          background: "var(--surface-base, var(--bg-1))",
          border: "1px solid var(--border)", borderRadius: "12px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 4px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
          <button className="ab-pill" onClick={onClose} aria-label="닫기" style={{ padding: "2px 8px" }}>✕</button>
        </div>
        <p className="muted" style={{ fontSize: "11px", margin: "0 18px 12px" }}>
          체크로 표시/숨김, ↑↓로 순서 변경. 표시 중 {visibleCount}/{keys.length}개. <strong>저장</strong>을 눌러야 반영됩니다.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "0 18px", overflow: "auto" }}>
          {eff.map((key, i) => {
            const it = byKey.get(key);
            if (!it) return null;
            const shown = !hidden.has(key);
            return (
              <div
                key={key}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "7px 8px", borderRadius: "7px",
                  border: "1px solid var(--border)",
                  background: shown ? "var(--bg-2, transparent)" : "transparent",
                  opacity: shown ? 1 : 0.55,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, cursor: "pointer", minWidth: 0 }}>
                  <input type="checkbox" checked={shown} onChange={() => toggle(key)} />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.label}
                    {it.desc ? <span className="muted" style={{ fontSize: "11px", marginLeft: "6px" }}>{it.desc}</span> : null}
                  </span>
                </label>
                <button
                  className="ab-pill" aria-label="위로" title="위로"
                  onClick={() => move(key, -1)} disabled={i === 0}
                  style={{ padding: "2px 8px", opacity: i === 0 ? 0.35 : 1 }}
                >↑</button>
                <button
                  className="ab-pill" aria-label="아래로" title="아래로"
                  onClick={() => move(key, 1)} disabled={i === eff.length - 1}
                  style={{ padding: "2px 8px", opacity: i === eff.length - 1 ? 0.35 : 1 }}
                >↓</button>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 18px", borderTop: "1px solid var(--border)", marginTop: "12px" }}>
          <button className="ab-pill" onClick={resetDraft}>기본값으로 초기화</button>
          <span className="muted" style={{ fontSize: "10px", flex: 1, lineHeight: 1.3 }}>
            🔒 이 브라우저에만 저장 (데이터 서버 전송 없음)
          </span>
          <button className="ab-pill" onClick={onClose}>취소</button>
          <button
            className={`ab-pill ${dirty ? "active" : ""}`}
            onClick={save}
            style={{ fontWeight: 700 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

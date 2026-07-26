"use client";
import React, { useState, useRef, useEffect, useId } from "react";
import { trackProductEvent } from "@/lib/analytics";
import { downloadJson } from "@/utils/download";

// 결과 다운로드 허브 — 도구마다 흩어져 있던 PNG/CSV/텍스트 다운로드 버튼을
// 눈에 잘 띄는 단일 드롭다운("⬇ 결과 받기 ▾")으로 통일한다(디자인시스템 §1).
// 순수 표시 컴포넌트 — 실제 다운로드 로직(downloadChartAsPNG·downloadCsv 등)은
// 각 도구가 items[].onSelect로 주입한다(엔진·유틸 불변).
//
// items: [{ label, desc?, icon?, onSelect }]  (onSelect 없거나 disabled면 비활성)
export default function DownloadHub({
  items = [],
  label = "결과 받기",
  align = "left",
  className = "",
  buttonStyle,
  toolId,
  manifest = null,
  locale = "ko",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const manifestItem = manifest ? {
    label: locale === "en" ? "Run details (JSON)" : "실행 정보(JSON)",
    desc: locale === "en"
      ? `Filter · units · engine version · warnings · source: ${manifest.source || "unknown"}`
      : `필터·단위·엔진 버전·경고 · 원본: ${manifest.source || "알 수 없음"}`,
    icon: "ⓘ",
    analyticsType: "manifest",
    onSelect: () => downloadJson(manifest, `${toolId || "analysis"}_manifest`),
  } : null;
  const usable = [...items, manifestItem].filter((it) => it && it.onSelect);

  // 바깥 클릭 / ESC로 닫기.
  useEffect(() => {
    if (!open) return;
    const firstItem = menuRef.current?.querySelector('[role="menuitem"]');
    firstItem?.focus();
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (!menuRef.current || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
      const buttons = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
      if (!buttons.length) return;
      e.preventDefault();
      const current = buttons.indexOf(document.activeElement);
      const next = e.key === "ArrowDown"
        ? (current + 1 + buttons.length) % buttons.length
        : (current - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (usable.length === 0) return null;

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        ref={triggerRef}
        className="ab-pill"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={label}
        style={{ fontWeight: 600, ...buttonStyle }}
      >
        ⬇ {label} ▾
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align === "right" ? "right" : "left"]: 0,
            minWidth: "220px",
            zIndex: 50,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius, 10px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            padding: "6px",
          }}
        >
          {usable.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                trackProductEvent("result_downloaded", { tool_id: toolId, source: "export", download_type: it.analyticsType || "other" });
                it.onSelect();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                padding: "8px 10px",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: "13px",
                lineHeight: 1.4,
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-hover, rgba(255,255,255,0.05))")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {it.icon ? `${it.icon} ` : ""}{it.label}
              </span>
              {it.desc && (
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {it.desc}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import React, { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { trackProductEvent } from "@/lib/analytics";
import { downloadJson } from "@/utils/download";

// 결과 다운로드 허브 — Radix 포털과 roving focus를 사용해 glass/sticky 조상과
// 무관하게 메뉴를 배치하고 키보드 동작을 표준화한다.
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
  const manifestItem = manifest ? {
    label: locale === "en" ? "Run details (JSON)" : "실행 정보(JSON)",
    desc: locale === "en"
      ? `Filter · units · engine version · warnings · source: ${manifest.source || "unknown"}`
      : `필터·단위·엔진 버전·경고 · 원본: ${manifest.source || "알 수 없음"}`,
    icon: "ⓘ",
    analyticsType: "manifest",
    onSelect: () => downloadJson(manifest, `${toolId || "analysis"}_manifest`),
  } : null;
  const usable = [...items, manifestItem].filter((item) => item?.onSelect);

  if (usable.length === 0) return null;

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`ab-pill ${className}`.trim()}
          aria-label={label}
          style={{ fontWeight: 600, ...buttonStyle }}
        >
          ⬇ {label} ▾
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align === "right" ? "end" : "start"}
          sideOffset={6}
          style={{
            minWidth: "220px",
            zIndex: 50,
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius, 10px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
            padding: "6px",
          }}
        >
          {usable.map((item) => (
            <DropdownMenu.Item
              key={`${item.analyticsType || "item"}-${item.label}`}
              onSelect={() => {
                trackProductEvent("result_downloaded", { tool_id: toolId, source: "export", download_type: item.analyticsType || "other" });
                item.onSelect();
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
              onFocus={(event) => { event.currentTarget.style.background = "var(--surface-hover, rgba(255,255,255,0.05))"; }}
              onBlur={(event) => { event.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {item.icon ? `${item.icon} ` : ""}{item.label}
              </span>
              {item.desc && (
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {item.desc}
                </span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

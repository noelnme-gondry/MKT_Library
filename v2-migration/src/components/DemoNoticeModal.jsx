"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/store/useDataStore";
import ModalDialog from "@/components/ds/ModalDialog";

// 도구 진입 시 "데모 데이터 사용 중" 안내 — 세션당 1회(store demoNoticeSeen 휘발).
// 현재 활성 데이터가 데모(fileName "demo_" 접두)일 때만.
const DATA_PREP_TARGETS = [
  ".csv-dropzone",
  ".dropzone",
  "#dashboard-data-setup",
  "#s-prep",
  "[data-data-prep]",
  ".csv-uploader",
];

function focusDataPrepAfterRender() {
  if (typeof document === "undefined") return;
  const target = DATA_PREP_TARGETS.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!(target instanceof HTMLElement)) return;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView?.({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  const hadTabIndex = target.hasAttribute("tabindex");
  const addedTabIndex = target.tabIndex < 0 && !hadTabIndex;
  if (addedTabIndex) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  if (addedTabIndex) {
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
}

function scheduleDataPrepFocus() {
  if (typeof window === "undefined") return;
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => window.requestAnimationFrame(focusDataPrepAfterRender));
  } else {
    window.setTimeout(focusDataPrepAfterRender, 0);
  }
}

export default function DemoNoticeModal({ locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const csvData = useAppStore((s) => s.csvData);
  const seen = useAppStore((s) => s.demoNoticeSeen);
  const setSeen = useAppStore((s) => s.setDemoNoticeSeen);
  const clearCsvGroup = useAppStore((s) => s.clearCsvGroup);
  const [open, setOpen] = useState(false);
  const primaryActionRef = useRef(null);

  const isDemo = !!(csvData && csvData.fileName && csvData.fileName.startsWith("demo"));

  useEffect(() => {
    // 조건부 1회 발화(데모 & 미노출) — 무한루프 없음(setSeen이 재발화 차단).
    if (isDemo && !seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      setSeen(); // 세션 1회 — 이후 다른 탭 진입해도 안 뜸
    }
  }, [isDemo, seen, setSeen]);

  const close = () => setOpen(false);
  const useMyCsv = () => {
    clearCsvGroup();
    setOpen(false);
    scheduleDataPrepFocus();
  };

  return (
    <ModalDialog
      open={open}
      onClose={close}
      ariaLabel={tr("지금은 데모 데이터를 이용 중입니다", "You're currently viewing demo data")}
      initialFocusRef={primaryActionRef}
      overlayStyle={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", padding: "20px" }}
      panelStyle={{ boxSizing: "border-box", maxWidth: "420px", width: "100%", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "14px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)", padding: "22px 24px" }}
    >
      <div style={{ fontSize: "26px", marginBottom: "10px" }}>🧪</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
        {tr("지금은 데모 데이터를 이용 중입니다", "You're currently viewing demo data")}
      </div>
      <p style={{ fontSize: "13.5px", lineHeight: 1.65, color: "var(--text-secondary)", margin: "0 0 18px" }}>
        {tr(
          "표시된 수치는 예시이며 내 데이터가 아닙니다. 내 CSV는 이 브라우저 안에서만 처리되고 서버로 업로드되지 않습니다.",
          "The numbers shown are examples, not your data. Your CSV is processed only in this browser and is not uploaded to our servers."
        )}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={close} style={{ fontSize: "13px", padding: "9px 18px" }}>
          {tr("나중에", "Not now")}
        </button>
        <button ref={primaryActionRef} type="button" className="btn primary" onClick={useMyCsv} style={{ fontSize: "13px", padding: "9px 18px" }}>
          {tr("내 CSV로 바꾸기", "Use my CSV")}
        </button>
      </div>
    </ModalDialog>
  );
}

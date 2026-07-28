"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/store/useDataStore";

// 도구 진입 시 "데모 데이터 사용 중" 안내 — 세션당 1회(store demoNoticeSeen 휘발).
// 현재 활성 데이터가 데모(fileName "demo_" 접두)일 때만. 우상단 CSV 변경 버튼 안내.
export default function DemoNoticeModal({ locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const csvData = useAppStore((s) => s.csvData);
  const seen = useAppStore((s) => s.demoNoticeSeen);
  const setSeen = useAppStore((s) => s.setDemoNoticeSeen);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 포털 대상(document.body) 준비 — 클라이언트 마운트 후에만 렌더.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDemo = !!(csvData && csvData.fileName && csvData.fileName.startsWith("demo"));

  useEffect(() => {
    // 조건부 1회 발화(데모 & 미노출) — 무한루프 없음(setSeen이 재발화 차단).
    if (isDemo && !seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      setSeen(); // 세션 1회 — 이후 다른 탭 진입해도 안 뜸
    }
  }, [isDemo, seen, setSeen]);

  if (!mounted || !open) return null;

  const close = () => setOpen(false);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", padding: "20px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", maxWidth: "420px", width: "100%", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "14px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)", padding: "22px 24px" }}
      >
        <div style={{ fontSize: "26px", marginBottom: "10px" }}>🧪</div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          {tr("지금은 데모 데이터를 이용 중입니다", "You're currently viewing demo data")}
        </div>
        <p style={{ fontSize: "13.5px", lineHeight: 1.65, color: "var(--text-secondary)", margin: "0 0 18px" }}>
          {tr(
            <>내 데이터로 분석하려면 <strong>우측 상단의 “🔄 CSV 변경” 버튼</strong>을 눌러 CSV를 업로드하세요. 업로드한 데이터는 브라우저에서만 처리되며 서버로 전송되지 않습니다.</>,
            <>To analyze your own data, click the <strong>“🔄 Change CSV” button at the top right</strong> and upload your CSV. Your data is processed only in the browser and never sent to any server.</>
          )}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn primary" onClick={close} style={{ fontSize: "13px", padding: "9px 18px" }}>
            {tr("확인", "Got it")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

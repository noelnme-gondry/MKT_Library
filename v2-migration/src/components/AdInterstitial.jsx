"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/store/useDataStore";

// 분석하기 클릭 시 뜨는 전면(인터스티셜) 광고 모달. 뒤 배경은 블러, 가운데 광고 카드,
// N초 카운트다운 후에만 닫기(X) 활성화 → 닫으면 store.closeAd가 보류된 분석을 실행.
// adFree 유저는 store.requestAd가 광고 없이 즉시 실행하므로 이 모달은 아예 안 뜸.
//
// AdSense 정책 주의: 콘텐츠 강제 게이팅은 위반 소지 → 카운트다운·명시 라벨로 완화.
// 실수 클릭 방지 위해 광고 영역과 닫기 버튼을 분리 배치.

const AD_CLOSE_SECONDS = 5; // 닫기 활성화까지 대기 초
const AD_CLIENT = "ca-pub-3073450406371629";
const AD_SLOT = "1732634045";

export default function AdInterstitial() {
  const open = useAppStore((s) => s.adGate.open);
  const seq = useAppStore((s) => s.adGate.seq);
  const closeAd = useAppStore((s) => s.closeAd);
  const [left, setLeft] = useState(AD_CLOSE_SECONDS);
  const [mounted, setMounted] = useState(false);

  // 포털 대상(document.body)은 클라이언트에만 존재 — 마운트 후 렌더.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // 열릴 때마다(seq) 카운트다운 리셋 + 1초씩 감소.
  useEffect(() => {
    if (!open) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeft(AD_CLOSE_SECONDS);
    const t = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open, seq]);

  // 열릴 때마다 새 ins(key=seq)로 리마운트되므로 그 뒤 광고 push. 이미 채워진 ins에
  // 재push하면 AdSense가 throw → try/catch. 라이브에서만 실제 광고 노출(로컬은 빈칸 가능).
  useEffect(() => {
    if (!open) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense 미로드·중복 push 등 — 무시(모달은 정상 동작) */
    }
  }, [open, seq]);

  if (!mounted || !open) return null;

  const canClose = left <= 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(10,12,16,0.55)",
        backdropFilter: "blur(8px) saturate(120%)",
        WebkitBackdropFilter: "blur(8px) saturate(120%)",
      }}
    >
      <div
        style={{
          width: "min(92vw, 400px)",
          background: "var(--surface-base, #16181d)",
          border: "1px solid var(--border, #2a2d34)",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          padding: "16px 16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.02em" }}>광고 · Advertisement</span>
          <button
            onClick={canClose ? closeAd : undefined}
            disabled={!canClose}
            aria-label={canClose ? "광고 닫고 분석 보기" : `${left}초 후 닫기`}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, #2a2d34)",
              background: canClose ? "var(--primary, #adc6ff)" : "transparent",
              color: canClose ? "#0b0d12" : "var(--text-muted)",
              cursor: canClose ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
            }}
          >
            {canClose ? "✕ 닫고 분석 보기" : `${left}초 후 닫기`}
          </button>
        </div>

        {/* 광고 슬롯 — 라이브에서 채워짐. 로컬/미충전 시 빈 영역(최소 높이 유지). */}
        <div style={{ minHeight: "250px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-container-lowest, #101216)", borderRadius: "10px", overflow: "hidden" }}>
          <ins
            key={seq}
            className="adsbygoogle"
            style={{ display: "block", width: "100%", minWidth: "250px" }}
            data-ad-client={AD_CLIENT}
            data-ad-slot={AD_SLOT}
            data-ad-format="auto"
            data-full-width-responsive="true"
          ></ins>
        </div>

        <p style={{ margin: 0, fontSize: "10.5px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
          광고를 닫으면 분석 결과가 표시됩니다. 데이터는 브라우저에서만 처리돼 서버로 전송되지 않습니다.
        </p>
      </div>
    </div>,
    document.body,
  );
}

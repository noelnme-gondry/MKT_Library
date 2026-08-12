"use client";
import React, { useCallback, useSyncExternalStore } from "react";
import { applyConsent, readStoredConsent, writeStoredConsent } from "@/lib/consent";

// 지역 무관 계측 opt-out.
//
// 왜: Consent Mode의 region 기본거부는 EEA/UK만 덮고, 배너도 looksEeaVisitor()가
// 참일 때만 뜬다. 주 타겟인 KR 사용자는 배너를 보지 못하고 끄는 방법도 없었다
// (감사 P1-12). 법적 요구는 아니지만 "사내 민감 자료를 다루는 도구"라는 제품의
// 자기 기준과 어긋난다. 저장 키·gtag 갱신은 기존 consent.js를 그대로 재사용한다.
const COPY = {
  ko: {
    on: "방문 통계·광고 측정 켜짐",
    off: "방문 통계·광고 측정 꺼짐",
    enable: "측정 허용",
    disable: "측정 끄기",
    note: "이 브라우저에만 저장됩니다. 분석 도구의 계산과 CSV 처리에는 영향이 없습니다.",
  },
  en: {
    on: "Analytics and ad measurement are on",
    off: "Analytics and ad measurement are off",
    enable: "Allow measurement",
    disable: "Turn measurement off",
    note: "Stored in this browser only. It does not affect the analysis tools or CSV processing.",
  },
};

// localStorage는 React 밖의 외부 저장소다. useEffect+setState로 읽으면
// set-state-in-effect(§5)에 걸리고 SSR 스냅샷도 어긋난다 → useSyncExternalStore.
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
// 저장된 선택이 없으면 기본은 허용(EEA는 region 기본거부가 별도로 적용된다).
const getSnapshot = () => readStoredConsent() || "granted";
// 서버에서는 항상 허용 상태로 그려 하이드레이션 불일치를 피한다.
const getServerSnapshot = () => "granted";

export default function AnalyticsOptOut({ locale = "ko" }) {
  const t = COPY[locale] || COPY.ko;
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const granted = consent === "granted";
  const next = granted ? "denied" : "granted";
  const toggle = useCallback(() => {
    writeStoredConsent(next);
    applyConsent(next);
    notify();
  }, [next]);

  return (
    <div className="callout" style={{ marginTop: "0.75rem" }}>
      <div className="body">
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>{granted ? t.on : t.off}</p>
        <button
          type="button"
          className="btn ghost"
          aria-pressed={!granted}
          onClick={toggle}
        >
          {granted ? t.disable : t.enable}
        </button>
        <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "12px" }}>{t.note}</p>
      </div>
    </div>
  );
}

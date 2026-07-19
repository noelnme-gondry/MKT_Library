"use client";
import React, { useEffect, useState } from "react";
import { MOCKS } from "./ToolCardMock";

// 각 장면은 실제 도구가 답하는 질문·결론·다음 조치를 축약해 보여 준다.
// 자동 전환은 제품 범위를 보여 주고, 임의의 장식성 차트가 되지 않게 모든 장면에
// 운영 문맥과 의사결정 문장을 넣는다.
const SCENES = [
  {
    title: { ko: "W29 운영 리포트", en: "W29 operating review" },
    type: "kpiLine",
    kpis: [
      { l: { ko: "전환", en: "Conv." }, v: "3,412", d: "+12.4%", up: true },
      { l: { ko: "CPA", en: "CPA" }, v: "₩8,240", d: "−6.1%", up: true },
      { l: { ko: "ROAS", en: "ROAS" }, v: "214%", d: "+8.0%", up: true },
    ],
    chartLabel: { ko: "최근 7일 전환 추이", en: "Conversion trend · last 7 days" },
    side: [
      { l: { ko: "가장 큰 변화", en: "Largest change" }, v: "Meta · CPA −₩540", c: "#4ade80" },
      { l: { ko: "오늘 확인", en: "Check today" }, v: { ko: "소재 교체 2건", en: "2 creative swaps" }, c: "#fbbf24" },
      { l: { ko: "다음 조치", en: "Next action" }, v: { ko: "Google +₩300k 검토", en: "Review Google +₩300k" }, c: "#adc6ff" },
    ],
  },
  {
    title: { ko: "성과 변동 분해", en: "Performance variance" },
    type: "diverge",
    kpis: [
      { l: { ko: "지난주 CPA", en: "Prior CPA" }, v: "₩8,240", d: "기준", up: true },
      { l: { ko: "이번주 CPA", en: "Current CPA" }, v: "₩9,030", d: "+9.6%", up: false },
      { l: { ko: "가장 큰 기여", en: "Top contributor" }, v: "Meta", d: "+₩510", up: false },
    ],
    chartLabel: { ko: "CPA 변화의 기여도", en: "Contribution to CPA change" },
    chip: { t: { ko: "원인 확인 필요", en: "Needs review" }, tone: "warn" },
    side: [
      { l: { ko: "채널", en: "Channel" }, v: { ko: "Meta · +₩510", en: "Meta · +₩510" }, c: "#f87171" },
      { l: { ko: "캠페인", en: "Campaign" }, v: { ko: "신규유입 · +₩380", en: "Prospecting · +₩380" }, c: "#fbbf24" },
      { l: { ko: "다음 조치", en: "Next action" }, v: { ko: "소재·타겟 확인", en: "Review creative & audience" }, c: "#adc6ff" },
    ],
  },
  {
    title: { ko: "소재 피로도", en: "Creative fatigue" },
    type: "scatter",
    kpis: [
      { l: { ko: "분석 소재", en: "Creatives" }, v: "48", d: { ko: "최근 28일", en: "last 28d" }, up: true },
      { l: { ko: "즉시 교체", en: "Replace now" }, v: "2", d: { ko: "우선순위 높음", en: "high priority" }, up: false },
      { l: { ko: "권장 제작", en: "Recommended" }, v: "4/주", d: { ko: "교체 속도", en: "swap velocity" }, up: true },
    ],
    chartLabel: { ko: "성과와 피로도", en: "Performance vs. fatigue" },
    chip: { t: { ko: "교체 일정 생성됨", en: "Swap plan ready" }, tone: "warn" },
    side: [
      { l: { ko: "교체 1순위", en: "First to swap" }, v: "UGC_07", c: "#f87171" },
      { l: { ko: "피로 신호", en: "Fatigue signal" }, v: { ko: "CTR −31%", en: "CTR −31%" }, c: "#fbbf24" },
      { l: { ko: "다음 제작", en: "Next production" }, v: { ko: "후킹 A/B", en: "Hook A/B" }, c: "#4ade80" },
    ],
  },
  {
    title: { ko: "예산 여력 진단", en: "Budget headroom" },
    type: "curve",
    kpis: [
      { l: { ko: "현재 일예산", en: "Daily spend" }, v: "₩1.2M", d: { ko: "Google", en: "Google" }, up: true },
      { l: { ko: "한계 CPA", en: "Marginal CPA" }, v: "₩9,100", d: { ko: "목표 내", en: "within target" }, up: true },
      { l: { ko: "증액 여력", en: "Headroom" }, v: "+₩300k", d: { ko: "테스트 권장", en: "test recommended" }, up: true },
    ],
    chartLabel: { ko: "지출 대비 반응 곡선", en: "Spend-response curve" },
    chip: { t: { ko: "증액 가능", en: "Can scale" }, tone: "good" },
    side: [
      { l: "Google UAC", v: { ko: "여유 있음", en: "headroom" }, c: "#4ade80" },
      { l: "Meta", v: { ko: "관찰", en: "monitor" }, c: "#fbbf24" },
      { l: { ko: "다음 조치", en: "Next action" }, v: { ko: "+₩300k 실험", en: "Test +₩300k" }, c: "#adc6ff" },
    ],
  },
];

export default function ProductPreview({ videoSrc = null, poster = null, locale = "ko" }) {
  const tr = (o) => (typeof o === "string" ? o : locale === "en" ? o.en : o.ko);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (videoSrc) return;
    const timer = setInterval(() => {
      setShown(false);
      setTimeout(() => { setIdx((current) => (current + 1) % SCENES.length); setShown(true); }, 220);
    }, 4200);
    return () => clearInterval(timer);
  }, [videoSrc]);
  const scene = SCENES[idx];
  const Mock = MOCKS[scene.type] || MOCKS.kpiLine;

  const kpiTile = (k, i) => (
    <div key={i} style={{ flex: 1, background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "9px 12px" }}>
      <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{tr(k.l)}</div>
      <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.2 }}>{k.v}</div>
      <div style={{ fontSize: "10.5px", color: k.up ? "#4ade80" : "#f0917e", fontWeight: 600 }}>{tr(k.d)}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: "920px", margin: "0 auto" }}>
      <div style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.22)", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", borderBottom: "1px solid var(--border-subtle, var(--border))", background: "var(--surface-container-lowest, rgba(255,255,255,0.02))" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>{tr(scene.title)}</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{locale === "en" ? "REFRESHED 09:00 KST" : "09:00 KST 기준"}</span>
        </div>

        {videoSrc ? (
          <video src={videoSrc} poster={poster || undefined} autoPlay muted loop playsInline style={{ width: "100%", display: "block" }} />
        ) : (
          <div style={{ padding: "16px", pointerEvents: "none", minHeight: "312px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: shown ? 1 : 0, transition: "opacity 0.22s ease" }}>
              {/* 상단 KPI 스트립 */}
              {scene.kpis && (
                <div style={{ display: "flex", gap: "10px" }}>{scene.kpis.map(kpiTile)}</div>
              )}
              {/* 본문: 차트 + (선택) 사이드 요약 */}
              <div style={{ display: "grid", gridTemplateColumns: scene.side ? "1.7fr 1fr" : "1fr", gap: "12px" }}>
                <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "12px", height: scene.kpis ? "196px" : "240px", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-secondary)" }}>{tr(scene.chartLabel)}</span>
                    {scene.chip && (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", color: scene.chip.tone === "good" ? "#166534" : "#92400e", background: scene.chip.tone === "good" ? "#bbf7d0" : "#fde68a" }}>{tr(scene.chip.t)}</span>
                    )}
                  </div>
                  <div style={{ height: scene.kpis ? "150px" : "196px" }}><Mock /></div>
                </div>

                {scene.side && (
                  <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "12px", height: scene.kpis ? "196px" : "240px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)" }}>{locale === "en" ? "Breakdown" : "요약"}</span>
                    {scene.side.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "var(--text-secondary)", minWidth: 0 }}>
                          {s.c && <span style={{ width: 9, height: 9, borderRadius: "3px", background: s.c, flexShrink: 0 }} />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr(s.l)}</span>
                        </span>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{tr(s.v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {!videoSrc && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
        {SCENES.map((item, i) => <button key={item.title.en} type="button" aria-label={tr(item.title)} onClick={() => { setShown(false); setTimeout(() => { setIdx(i); setShown(true); }, 180); }} style={{ width: i === idx ? "auto" : 8, height: 8, padding: i === idx ? "0 8px" : 0, border: "none", borderRadius: 8, background: i === idx ? "var(--primary)" : "var(--border-stronger, var(--border))", color: "var(--bg-1)", cursor: "pointer", fontSize: 0 }}>
          {i === idx ? tr(item.title) : ""}
        </button>)}
      </div>}
    </div>
  );
}

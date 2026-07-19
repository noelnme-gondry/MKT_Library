"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const SCENES = [
  {
    href: "/dashboard",
    short: { ko: "주간 브리핑", en: "Weekly brief" },
    title: { ko: "이번 주는 효율이 좋아졌지만, Google 증액 전 검증이 필요합니다.", en: "Efficiency improved this week, but validate Google before scaling." },
    state: { ko: "관찰 후 증액", en: "Validate, then scale" }, tone: "watch",
    metrics: [["CPA", "₩8,240", "−6.1%"], ["ROAS", "214%", "+8.0%"], [{ ko: "전환", en: "Conversions" }, "3,412", "+12.4%"]],
    evidence: [
      [{ ko: "Meta 효율", en: "Meta efficiency" }, 78, { ko: "CPA −₩540", en: "CPA −₩540" }, "good"],
      [{ ko: "Google 여력", en: "Google headroom" }, 62, "+₩300k", "accent"],
      [{ ko: "소재 상태", en: "Creative health" }, 34, { ko: "2건 교체", en: "2 swaps" }, "bad"],
    ],
    actions: [{ ko: "Google 예산 +₩300k 소규모 실험", en: "Run a +₩300k Google budget test" }, { ko: "UGC_07·12 소재 교체", en: "Replace UGC_07 and UGC_12" }, { ko: "48시간 뒤 CPA 재확인", en: "Recheck CPA after 48 hours" }],
  },
  {
    href: "/tools/campaign-variance",
    short: { ko: "변동 원인", en: "Variance" },
    title: { ko: "CPA 상승분 ₩790 중 ₩510은 Meta의 효율 저하에서 왔습니다.", en: "₩510 of the ₩790 CPA increase came from Meta efficiency loss." },
    state: { ko: "원인 특정", en: "Driver isolated" }, tone: "bad",
    metrics: [[{ ko: "지난주 CPA", en: "Prior CPA" }, "₩8,240", "BASE"], [{ ko: "이번주 CPA", en: "Current CPA" }, "₩9,030", "+9.6%"], [{ ko: "설명된 변화", en: "Explained" }, "100%", { ko: "잔차 0", en: "no residual" }]],
    evidence: [["Meta", 82, "+₩510", "bad"], [{ ko: "신규유입 캠페인", en: "Prospecting" }, 61, "+₩380", "watch"], ["Google", 27, "−₩100", "good"]],
    actions: [{ ko: "Meta 신규유입 소재·타겟 확인", en: "Review Meta prospecting creative and audience" }, { ko: "배분 변화와 효율 변화를 분리", en: "Separate mix change from efficiency change" }, { ko: "문제 캠페인만 단계적으로 감액", en: "Reduce only the affected campaign" }],
  },
  {
    href: "/content/freshness",
    short: { ko: "소재 피로", en: "Creative fatigue" },
    title: { ko: "48개 중 2개는 지금 교체하고, 이번 주 4개를 새로 제작하세요.", en: "Replace 2 of 48 creatives now and produce 4 new variants this week." },
    state: { ko: "교체 큐 생성", en: "Swap queue ready" }, tone: "watch",
    metrics: [[{ ko: "분석 소재", en: "Creatives" }, "48", "28D"], [{ ko: "즉시 교체", en: "Replace now" }, "2", { ko: "긴급", en: "urgent" }], [{ ko: "권장 제작", en: "Produce" }, "4/주", { ko: "속도", en: "velocity" }]],
    evidence: [["UGC_07", 88, "CTR −31%", "bad"], ["STATIC_12", 71, "CPA +24%", "watch"], ["UGC_03", 26, { ko: "유지", en: "keep" }, "good"]],
    actions: [{ ko: "UGC_07 오늘 교체", en: "Replace UGC_07 today" }, { ko: "후킹 문구 A/B 2종 제작", en: "Produce 2 hook-message variants" }, { ko: "다음 주 교체 속도 재계산", en: "Recalculate swap velocity next week" }],
  },
  {
    href: "/tools/marketing-response",
    short: { ko: "MMM·예측", en: "MMM & forecast" },
    title: { ko: "Google은 아직 성장 여력이 있고, Meta는 현재 수준을 유지하는 편이 낫습니다.", en: "Google still has growth headroom; hold Meta at its current level." },
    state: { ko: "예산 시나리오", en: "Budget scenario" }, tone: "good",
    metrics: [[{ ko: "예측 증분", en: "Forecast lift" }, "+9.8%", { ko: "4주", en: "4 weeks" }], [{ ko: "권장 이동", en: "Budget move" }, "+₩8.4M", "Google"], [{ ko: "시나리오 범위", en: "Scenario spread" }, "±3.1%", { ko: "참고값", en: "reference" }]],
    evidence: [["Google UAC", 79, { ko: "증액", en: "scale" }, "good"], ["Meta", 53, { ko: "유지", en: "hold" }, "watch"], ["TikTok", 31, { ko: "학습 부족", en: "low data" }, "muted"]],
    actions: [{ ko: "Google +10% 시나리오 실행", en: "Run the Google +10% scenario" }, { ko: "Meta는 기준 예산 유지", en: "Hold Meta at baseline spend" }, { ko: "홀드아웃으로 인과효과 확인", en: "Validate causality with a holdout" }],
  },
];

export default function ProductPreview({ videoSrc = null, poster = null, locale = "ko" }) {
  const tr = (value) => typeof value === "string" ? value : locale === "en" ? value.en : value.ko;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timeoutRef = useRef(null);
  const scene = SCENES[index];
  const selectScene = useCallback((next) => {
    setVisible(false);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => { setIndex(next); setVisible(true); }, 180);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduceMotion(media.matches);
    syncMotion();
    media.addEventListener?.("change", syncMotion);
    return () => media.removeEventListener?.("change", syncMotion);
  }, []);
  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);
  useEffect(() => {
    if (videoSrc || reduceMotion || isPaused) return undefined;
    const timer = window.setInterval(() => selectScene((index + 1) % SCENES.length), 5200);
    return () => { window.clearInterval(timer); window.clearTimeout(timeoutRef.current); };
  }, [index, isPaused, reduceMotion, videoSrc, selectScene]);

  if (videoSrc) return <video className="operator-preview__video" src={videoSrc} poster={poster || undefined} autoPlay muted loop playsInline />;
  return <div
    className="operator-preview"
    onMouseEnter={() => setIsPaused(true)}
    onMouseLeave={() => setIsPaused(false)}
    onFocusCapture={() => setIsPaused(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false); }}
  >
    <nav className="operator-preview__nav" aria-label={locale === "en" ? "Product examples" : "제품 기능 예시"}>
      <div className="operator-preview__brand"><span>GO</span><b>{locale === "en" ? "Decision desk" : "의사결정 데스크"}</b></div>
      {SCENES.map((item, itemIndex) => <button key={item.short.en} type="button" className={itemIndex === index ? "active" : ""} onClick={() => selectScene(itemIndex)} aria-pressed={itemIndex === index}><span>0{itemIndex + 1}</span>{tr(item.short)}</button>)}
      <small>{locale === "en" ? "RAW DATA STAYS LOCAL" : "원본 데이터는 브라우저 안에"}</small>
    </nav>
    <div className={`operator-preview__body${visible ? " is-visible" : ""}`}>
      <header className="operator-preview__head"><div><span>{tr(scene.short)} · W29</span><h2>{tr(scene.title)}</h2></div><em className={scene.tone}>{tr(scene.state)}</em></header>
      <div className="operator-preview__metrics">{scene.metrics.map(([label, value, delta]) => <div key={tr(label)}><span>{tr(label)}</span><strong>{value}</strong><small>{tr(delta)}</small></div>)}</div>
      <div className="operator-preview__workarea">
        <section className="operator-preview__evidence"><div className="operator-preview__section-head"><b>{locale === "en" ? "Decision evidence" : "판단 근거"}</b><span>{locale === "en" ? "relative contribution" : "상대 기여도"}</span></div>{scene.evidence.map(([label, width, value, tone]) => <div className="operator-preview__bar" key={tr(label)}><div><span>{tr(label)}</span><strong>{tr(value)}</strong></div><i><b className={tone} style={{ width: `${width}%` }}></b></i></div>)}</section>
        <section className="operator-preview__queue"><div className="operator-preview__section-head"><b>{locale === "en" ? "Action queue" : "실행 큐"}</b><span>{locale === "en" ? "ordered" : "순서대로"}</span></div><ol>{scene.actions.map((action, actionIndex) => <li key={tr(action)}><span>{actionIndex + 1}</span><p>{tr(action)}</p></li>)}</ol><Link href={`${locale === "en" ? "/en" : ""}${scene.href}`}>{locale === "en" ? "Open detailed analysis" : "상세 분석 열기"}<span>→</span></Link></section>
      </div>
    </div>
  </div>;
}

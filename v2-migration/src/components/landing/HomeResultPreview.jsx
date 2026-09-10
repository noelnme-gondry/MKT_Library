import { useMemo } from "react";
import Image from "next/image";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildDemoCsv } from "@/utils/demoData";

// The preview and its launch button use the same deterministic sample source.

export default function HomeResultPreview({ locale, onTrySample }) {
  const result = useMemo(() => compareSamplePerformance(buildDemoCsv("efficiency").raw), []);
  const en = locale === "en";
  const money = value => `${Math.round(value).toLocaleString(en ? "en-US" : "ko-KR")} ${en ? "KRW" : "원"}`;
  const percent = value => value == null ? (en ? "Unavailable" : "추정 불가") : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  const lead = result?.channels?.[0];
  if (!lead || !Number.isFinite(lead.prior.cpa) || !Number.isFinite(lead.recent.cpa) || lead.cpaChange <= 0) return null;
  const chartMax = Math.ceil(Math.max(lead.prior.cpa, lead.recent.cpa) / 5000) * 5000;
  return <aside className="home-result-preview home-result-preview--compact" aria-label={en ? "Sample analysis preview" : "샘플 분석 미리보기"}>
    <header><div><span>{en ? "DOCHI’S SAMPLE ANALYSIS" : "도치의 샘플 분석"}</span><h2>{en ? "The same action, at a higher cost." : <>같은 전환 한 건,<br />비용은 더 들었어요.</>}</h2></div><Image src="/assets/dochi/dochi-editorial.webp" width={96} height={96} alt={en ? "Dochi" : "도치"} /></header>
    <figure className="home-result-preview__channels">
      <figcaption>{lead.channel} · {en ? "Cost per key action" : "전환 1건당 광고비"}</figcaption>
      <div className="preview-cost-axis" aria-hidden="true"><span>0</span><span>{money(chartMax)}</span></div>
      {["prior", "recent"].map(period => <div className={`preview-cost-row is-${period}`} key={period}><span>{period === "prior" ? (en ? "Prior" : "전주") : (en ? "Recent" : "이번 주")}</span><div aria-hidden="true"><i style={{ width: `${lead[period].cpa / chartMax * 100}%` }} /></div><b>{money(lead[period].cpa)}</b></div>)}
      <p className="home-result-preview__difference">{en ? `${money(lead.recent.cpa - lead.prior.cpa)} more per action` : `한 건당 ${money(lead.recent.cpa - lead.prior.cpa)} 더 지출`} <span>({percent(lead.cpaChange)})</span></p>
      <p className="home-result-preview__basis">{en ? "Shorter = lower cost · Conversion means a key action" : "짧을수록 비용이 적음 · 전환은 핵심행동 수 기준"}</p>
    </figure>
    <div className="home-result-preview__insight"><strong>{en ? "What to check next" : "다음으로 확인할 것"}</strong><p>{en ? "Compare campaign spend and actions before changing the budget." : "예산을 바꾸기 전에, 캠페인별 비용과 전환 변화를 확인하세요."}</p></div>
    <p className="home-result-preview__basis">{en ? "Sample" : "체험용 데이터"} · {result.dates[0]} — {result.dates.at(-1)}</p>
    <button type="button" className="ab-button" onClick={onTrySample}>{en ? "Explore a sample" : "샘플로 체험하기"} →</button>
  </aside>;
}

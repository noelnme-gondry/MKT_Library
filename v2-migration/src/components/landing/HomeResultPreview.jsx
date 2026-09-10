import Image from "next/image";
import { summarizeSampleSpend } from "@/utils/sampleSpendPreview";
import { buildDemoCsv } from "@/utils/demoData";

// The preview and its launch button use the same deterministic sample source.
const sample = buildDemoCsv("efficiency");
const { dates, totals, total, peak, peakDay } = summarizeSampleSpend(sample.raw);

export default function HomeResultPreview({ locale, onTrySample }) {
  const en = locale === "en";
  const money = value => `${Math.round(value).toLocaleString(en ? "en-US" : "ko-KR")} ${en ? "KRW" : "원"}`;
  return <aside className="home-result-preview" aria-label={en ? "Sample analysis preview" : "샘플 분석 미리보기"}>
    <header><div><span>{en ? "SAMPLE DATA · LAST 7 DAYS" : "샘플 데이터 · 최근 7일"}</span><h2>{en ? "From numbers to your next check" : "숫자에서 다음 확인까지"}</h2></div><Image src="/assets/dochi/dochi-editorial.webp" width={80} height={80} alt="" /></header>
    <div className="home-result-preview__metric"><span>{en ? "Total ad spend" : "광고비 합계"}</span><strong>{money(total)}</strong><small>{dates[0]} — {dates.at(-1)}</small></div>
    <figure><figcaption>{en ? "Daily ad spend" : "일별 광고비"}</figcaption><div className="home-result-preview__bars">{totals.map(row => <div key={row.date} role="img" aria-label={`${row.date}: ${money(row.cost)}`}><span style={{ height: `${row.cost / peak * 100}%` }} title={`${row.date}: ${money(row.cost)}`} /><small>{row.date.slice(5)}</small></div>)}</div></figure>
    <div className="home-result-preview__insight"><strong>{en ? "What the data shows" : "데이터에서 확인한 점"}</strong><p>{en ? `Spend was highest on ${peakDay.date}: ${money(peak)}.` : `${peakDay.date} 광고비가 ${money(peak)}으로 가장 높았어요.`}</p><p>{en ? "Next, compare channels and conversions on that day. Spend alone does not establish efficiency." : "다음으로 해당 날짜의 채널별 비용과 전환을 함께 확인하세요. 비용만으로 효율을 판단할 수는 없어요."}</p></div>
    <button type="button" className="ab-button" onClick={onTrySample}>{en ? "Explore a sample" : "샘플로 체험하기"} →</button>
  </aside>;
}

import { useMemo } from "react";
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
    <header><div><span>{en ? "Sample analysis · Weekly comparison" : "샘플 분석 · 주간 비교"}</span><h2>{en ? "Cost per action has increased." : "전환 한 건에 드는 비용이 늘었습니다"}</h2></div></header>
    <p className="home-result-preview__basis">{en ? "Channel with the largest percentage increase in CPA" : "이 샘플에서 전환당 비용 상승률이 가장 높은 채널"} · {lead.channel}</p>
    <dl className="home-result-preview__kpis">
      <div><dt>{en ? "Spend change" : "광고비 변화"}</dt><dd>{percent(lead.costChange)}</dd></div>
      <div><dt>{en ? "Action change" : "전환 수 변화"}</dt><dd>{percent(lead.actionChange)}</dd></div>
      <div><dt>{en ? "CPA change" : "전환당 비용 변화"}</dt><dd>{percent(lead.cpaChange)}</dd></div>
    </dl>
    <figure className="home-result-preview__channels">
      <figcaption>{lead.channel} · {en ? "Cost per key action" : "전환 1건당 광고비"}</figcaption>
      <div className="preview-cost-axis" aria-hidden="true"><span>0</span><span>{money(chartMax)}</span></div>
      {["prior", "recent"].map(period => <div className={`preview-cost-row is-${period}`} key={period}><span>{period === "prior" ? (en ? "Prior" : "전주") : (en ? "Recent" : "이번 주")}</span><div aria-hidden="true"><i style={{ width: `${lead[period].cpa / chartMax * 100}%` }} /></div><b>{money(lead[period].cpa)}</b></div>)}
      <p className="home-result-preview__difference">{en ? `${money(lead.recent.cpa - lead.prior.cpa)} more per action` : `한 건당 ${money(lead.recent.cpa - lead.prior.cpa)} 더 지출`} <span>({percent(lead.cpaChange)})</span></p>
      <p className="home-result-preview__basis">{en ? "Shorter = lower cost · Conversion means a key action" : "짧을수록 비용이 적음 · 전환은 핵심행동 수 기준"}<br />{result.dates[0]} – {result.dates[6]} / {result.dates[7]} – {result.dates.at(-1)}</p>
    </figure>
    <div className="home-result-preview__insight"><strong>{en ? "What to check next" : "다음으로 확인할 것"}</strong><p>{en ? "Compare campaign spend and actions before changing the budget." : "예산을 바꾸기 전에, 캠페인별 비용과 전환 변화를 확인하세요."}</p></div>
    <p className="home-result-preview__basis">{en ? "Sample" : "체험용 데이터"} · {result.dates[0]} — {result.dates.at(-1)}</p>
    <button type="button" className="ab-button" onClick={onTrySample}>{en ? "Explore a sample" : "샘플로 체험하기"} →</button>
  </aside>;
}

import { useMemo } from "react";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildDemoCsv } from "@/utils/demoData";

// The preview and its launch button use the same deterministic sample source.

export default function HomeResultPreview({ locale, onTrySample }) {
  const result = useMemo(() => compareSamplePerformance(buildDemoCsv("efficiency").raw), []);
  const en = locale === "en";
  const money = value => `${Math.round(value).toLocaleString(en ? "en-US" : "ko-KR")} ${en ? "KRW" : "원"}`;
  const percent = value => value == null ? (en ? "Unavailable" : "추정 불가") : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  // 결과 화면과 같은 범위(유료 채널 전체)를 보여 준다 — 샘플을 누르면 이 숫자 그대로 이어진다.
  // 가장 많이 오른 채널은 따로 짚고, 결과 화면의 "성과 변동 원인"이 그 채널을 다시 가리킨다.
  const lead = result && { ...result, channel: en ? `${result.channels.length} paid channels` : `유료 채널 ${result.channels.length}개 합계` };
  const riser = result?.channels?.[0];
  if (!lead || !Number.isFinite(lead.prior.cpa) || !Number.isFinite(lead.recent.cpa) || !(lead.cpaChange > 0)) return null;
  const chartMax = Math.ceil(Math.max(lead.prior.cpa, lead.recent.cpa) / 5000) * 5000;
  return <aside className="home-result-preview home-result-preview--compact" aria-label={en ? "Sample analysis preview" : "샘플 분석 미리보기"}>
    <header><div><h2>{en ? "What changed this week, on sample data" : "샘플 데이터로 본 이번 주 변화"}</h2></div></header>
    <div className="home-result-preview__surface">
    <p className="home-result-preview__channel-label"><strong>{lead.channel}</strong><span>{en ? "Weekly comparison" : "주간 성과 비교"}</span></p>
    <dl className="home-result-preview__kpis">
      <div><dt>{en ? "Spend change" : "광고비 변화"}</dt><dd>{percent(lead.costChange)}</dd></div>
      <div><dt>{en ? "Action change" : "전환 수 변화"}</dt><dd>{percent(lead.actionChange)}</dd></div>
      <div><dt>{en ? "CPA change" : "전환당 비용 변화"}</dt><dd>{percent(lead.cpaChange)}</dd></div>
    </dl>
    <figure className="home-result-preview__channels">
      <figcaption>{en ? "Cost per key action" : "전환 1건당 광고비"}</figcaption>
      <div className="preview-cost-axis" aria-hidden="true"><span>0</span><span>{money(chartMax)}</span></div>
      {["prior", "recent"].map(period => <div className={`preview-cost-row is-${period}`} key={period}><span>{period === "prior" ? (en ? "Prior" : "전주") : (en ? "Recent" : "이번 주")}</span><div aria-hidden="true"><i style={{ width: `${lead[period].cpa / chartMax * 100}%` }} /></div><b>{money(lead[period].cpa)}</b></div>)}
      <p className="home-result-preview__difference">{en ? `${money(lead.recent.cpa - lead.prior.cpa)} more per action` : `한 건당 ${money(lead.recent.cpa - lead.prior.cpa)} 더 지출`} <span>({percent(lead.cpaChange)})</span></p>
    </figure>
    <div className="home-result-preview__insight"><strong>{en ? "What to check next" : "다음으로 확인할 것"}</strong><p>{en ? "Compare campaign spend and actions before changing the budget." : "예산을 바꾸기 전에, 캠페인별 비용과 전환 변화를 확인하세요."}</p></div>
    <section data-information-section="" className="home-result-preview__method"><header data-information-heading="">{en ? "Sample data & comparison basis" : "샘플 데이터·비교 기준"}</header><p className="home-result-preview__basis">{en ? `All paid channels combined; ${riser ? `${riser.channel} rose the most (${percent(riser.cpaChange)}). ` : ""}Conversion means a key action; shorter bars indicate lower cost.` : `유료 채널 전체 합계입니다${riser ? `. 가장 많이 오른 채널은 ${riser.channel}(${percent(riser.cpaChange)})` : ""}. 전환은 핵심행동 수 기준이며 막대가 짧을수록 비용이 적습니다.`}<br />{result.dates[0]} – {result.dates[6]}<br />{result.dates[7]} – {result.dates.at(-1)}</p></section>
    {/* 홈에서는 바로 옆 히어로 버튼이 같은 샘플을 연다 — 같은 버튼을 두 번 두지 않는다(2026-09-24). */}
    {onTrySample && <button type="button" className="ab-button" onClick={onTrySample}>{en ? "Explore a sample" : "샘플로 체험하기"} →</button>}
    </div>
  </aside>;
}

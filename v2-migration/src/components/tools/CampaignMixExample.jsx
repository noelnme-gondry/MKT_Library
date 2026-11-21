import PeriodBars from "@/components/ds/PeriodBars";
import { PVM_MATH } from "@/utils/pvmMath";

const aggregate = rows => PVM_MATH.aggregate(rows, "channel", "conversions");
const sample = PVM_MATH.decompose(
  aggregate([{ channel: "A", spend: 800, conversions: 80 }, { channel: "B", spend: 600, conversions: 20 }]),
  aggregate([{ channel: "A", spend: 200, conversions: 20 }, { channel: "B", spend: 2400, conversions: 80 }]),
);

export default function CampaignMixExample({ locale }) {
  const en = locale === "en";
  const periods = [
    { label: en ? "Prior" : "이전", share: "s1", value: sample.CPA1 },
    { label: en ? "Recent" : "최근", share: "s2", value: sample.CPA2 },
  ];
  return <section className="mix-preview">
    <h2>{en ? "Example · Why did overall CPA rise?" : "계산 예시 · 전체 CPA는 왜 올랐을까요?"}</h2>
    <figure><figcaption>{en ? "Share of conversions by channel" : "채널별 전환 비중"}</figcaption>
      {periods.map(({ label, share }) => <div className="mix-preview__period" key={label}>
        <span>{label}</span><div className="mix-preview__stack">{sample.entities.map(entity => {
          const percent = Math.round(entity[share] * 100);
          return <span key={entity.key} style={{ width: `${percent}%` }}>{entity.key} {percent}%</span>;
        })}</div>
      </div>)}
    </figure>
    <PeriodBars title={en ? "Overall cost per conversion (KRW)" : "전체 전환 한 건당 비용 (원)"}
      rows={periods.map(period => ({ ...period, display: en ? `₩${period.value}` : `${period.value}원` }))}
      max={Math.max(sample.CPA1, sample.CPA2)} />
    <p>{en ? "Channel costs stayed at " : "채널별 전환 단가는 "}{sample.entities.map(e => `${e.key} ₩${e.cpa1}`).join(", ")}
      {en ? ". More conversions came from the higher-cost channel." : "으로 그대로입니다. 단가가 높은 채널의 전환 비중이 커져 전체 CPA가 올랐습니다."}</p>
  </section>;
}

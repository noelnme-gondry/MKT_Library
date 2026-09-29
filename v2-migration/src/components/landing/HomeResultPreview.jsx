import { useMemo } from "react";
import Image from "next/image";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import { buildDemoCsv } from "@/utils/demoData";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { pvmTopDriver } from "@/lib/assistant/pvmChannelDriver";

// The preview and its launch button use the same deterministic sample source.

export default function HomeResultPreview({ locale, onTrySample }) {
  const result = useMemo(() => compareSamplePerformance(buildDemoCsv("efficiency").raw), []);
  const en = locale === "en";
  // "어디서 바뀌었나" 한 줄 — 샘플을 누르면 결과 화면의 성과 변동 원인(5-21)이 같은 입력·같은 함수로
  // 같은 채널을 지목한다(pvmChannelDriver). 계산할 수 없으면 줄을 그리지 않는다.
  const driver = useMemo(() => {
    try { return pvmTopDriver(buildSampleJourney(en ? "en" : "ko"), { resultField: "actions", unspecifiedLabel: en ? "Unspecified" : "미지정" }); } catch { return null; }
  }, [en]);
  const money = value => `${Math.round(value).toLocaleString(en ? "en-US" : "ko-KR")} ${en ? "KRW" : "원"}`;
  const percent = value => value == null ? (en ? "Unavailable" : "추정 불가") : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  // 결과 화면과 같은 범위(유료 채널 전체)를 보여 준다 — 샘플을 누르면 이 숫자 그대로 이어진다.
  const lead = result && { ...result, channel: en ? `${result.channels.length} paid channels` : `유료 채널 ${result.channels.length}개 합계` };
  if (!lead || !Number.isFinite(lead.prior.cpa) || !Number.isFinite(lead.recent.cpa) || !(lead.cpaChange > 0)) return null;
  const barMax = Math.max(lead.prior.cpa, lead.recent.cpa);
  return <aside className="home-result-preview home-result-preview--comparison" aria-label={en ? "Sample analysis preview" : "샘플 분석 미리보기"}>
    <h2>{en ? "Cost per conversion rose" : "전환당 비용이 올랐습니다"}</h2>
    <p className="home-sample-context">{en ? "Fictional data" : "가상 데이터"} · {lead.channel}</p>
    <table className="home-sample-table">
      <caption className="sr-only">{en ? "Cost per conversion by period, KRW" : "기간별 전환당 비용, 원"}</caption>
      <tbody>{["prior", "recent"].map((period, index) => <tr key={period} className={`is-${period}`}>
        <th scope="row">{index === 0 ? (en ? "Previous 7 days" : "이전 7일") : (en ? "Latest 7 days" : "최근 7일")}
          <span><time dateTime={result.dates[index * 7]}>{result.dates[index * 7]}</time> – <time dateTime={result.dates[index * 7 + 6]}>{result.dates[index * 7 + 6].slice(5)}</time></span>
        </th>
        <td>{money(lead[period].cpa)}</td>
        {/* 0에서 시작하는 축 — 두 값의 실제 비율 그대로다(장식 막대가 아니다). 숫자는 바로 옆 칸이 말한다. */}
        <td className="home-sample-bar" aria-hidden="true"><i style={{ width: `${(lead[period].cpa / barMax) * 100}%` }} /></td>
      </tr>)}</tbody>
    </table>
    <div className="home-sample-change">
      <div>
        <dl><dt>{en ? "CPA change" : "CPA 변화"}</dt><dd>{percent(lead.cpaChange)}</dd></dl>
        <p>{en ? `${money(Math.round(lead.recent.cpa) - Math.round(lead.prior.cpa))} more per conversion` : `전환 1건에 ${money(Math.round(lead.recent.cpa) - Math.round(lead.prior.cpa))} 더 들었습니다`}</p>
      </div>
      <Image src="/assets/dochi/dochi-present-results.png" width={72} height={72} alt="" />
    </div>
    {driver && <p className="home-sample-trace">
      <span>{en ? "Largest contribution to the change" : "변화 기여가 가장 큰 채널"}</span>
      <strong>{driver.entity}</strong>
      <b className="tnum">{`${driver.contribution >= 0 ? "+" : "−"}${money(Math.abs(driver.contribution))}`}</b>
    </p>}
    <p className="home-sample-context">{en ? "CPA = ad spend ÷ key actions" : "CPA = 광고비 ÷ 핵심행동 수"}</p>
    {/* 홈에서는 바로 옆 히어로 버튼이 같은 샘플을 연다 — 같은 버튼을 두 번 두지 않는다(2026-09-24). */}
    {onTrySample && <button type="button" className="ab-button" onClick={onTrySample}>{en ? "Explore a sample" : "샘플로 체험하기"} →</button>}
  </aside>;
}
